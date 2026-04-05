import Redis from 'ioredis';
import { promises as dns } from 'node:dns';
import { Resolver } from 'node:dns/promises';
import { BaseModule } from '../../base/BaseModule.js';
import { Normalizer } from '../../base/Normalizer.js';
import type {
  CollectionResult,
  NormalizedEntity,
  NormalizedRelationship,
  ModuleHealth,
  RateLimitConfig,
  CollectionError,
} from '../../base/types.js';

interface DnsRecordSet {
  A: string[];
  AAAA: string[];
  CNAME: string[];
  MX: Array<{ priority: number; exchange: string }>;
  TXT: string[][];
  NS: string[];
  SOA: { nsname: string; hostmaster: string; serial: number; refresh: number; retry: number; expire: number; minttl: number } | null;
  PTR: string[];
}

export class DnsModule extends BaseModule {
  name = 'dns';
  category = 'domain' as const;
  supportedEntityTypes = ['domain', 'ip'];
  rateLimit: RateLimitConfig = { maxTokens: 20, refillRate: 10, refillInterval: 1000 };
  cacheTTL = 1800;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private resolver: Resolver;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('dns');
    this.resolver = new Resolver();
    this.resolver.setServers(['8.8.8.8', '1.1.1.1', '9.9.9.9']);
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'domain', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entity);

      if (isIp) {
        // Reverse DNS
        try {
          const hostnames = await this.resolver.reverse(entity);
          apiCalls++;
          rawData['reverse'] = hostnames;

          const ipEntity = this.normalizer.createEntity({
            type: 'ip',
            name: entity,
            description: `Reverse DNS: ${hostnames.join(', ')}`,
            attributes: { reverseHostnames: hostnames },
            confidence: 0.9,
            tags: ['dns', 'reverse-dns'],
          });
          entities.push(ipEntity);

          for (const hostname of hostnames) {
            const domainEntity = this.normalizer.createEntity({
              type: 'domain',
              name: hostname,
              attributes: {},
              confidence: 0.85,
              tags: ['reverse-dns'],
            });
            entities.push(domainEntity);
            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: ipEntity.id,
                targetEntityId: domainEntity.id,
                type: 'resolves_to',
                label: 'reverse DNS',
                confidence: 0.9,
              })
            );
          }
        } catch (err) {
          errors.push(this.buildError('REVERSE_DNS_ERROR', `Reverse DNS failed: ${err}`));
        }
      } else {
        const records: DnsRecordSet = {
          A: [],
          AAAA: [],
          CNAME: [],
          MX: [],
          TXT: [],
          NS: [],
          SOA: null,
          PTR: [],
        };

        // A records
        try {
          records.A = await this.resolver.resolve4(entity);
          apiCalls++;
        } catch { /* no A records */ }

        // AAAA records
        try {
          records.AAAA = await this.resolver.resolve6(entity);
          apiCalls++;
        } catch { /* no AAAA records */ }

        // CNAME
        try {
          records.CNAME = await this.resolver.resolveCname(entity);
          apiCalls++;
        } catch { /* no CNAME */ }

        // MX
        try {
          records.MX = await this.resolver.resolveMx(entity);
          apiCalls++;
        } catch { /* no MX records */ }

        // TXT
        try {
          records.TXT = await this.resolver.resolveTxt(entity);
          apiCalls++;
        } catch { /* no TXT records */ }

        // NS
        try {
          records.NS = await this.resolver.resolveNs(entity);
          apiCalls++;
        } catch { /* no NS records */ }

        // SOA
        try {
          records.SOA = await this.resolver.resolveSoa(entity);
          apiCalls++;
        } catch { /* no SOA */ }

        rawData['records'] = records;

        // Analyze TXT records for interesting findings
        const txtFindings: string[] = [];
        const flatTxt = records.TXT.flat();
        for (const txt of flatTxt) {
          if (txt.startsWith('v=spf1')) txtFindings.push('SPF');
          if (txt.startsWith('v=DMARC1')) txtFindings.push('DMARC');
          if (txt.includes('google-site-verification')) txtFindings.push('Google verified');
          if (txt.includes('MS=')) txtFindings.push('Microsoft 365');
          if (txt.includes('facebook-domain-verification')) txtFindings.push('Facebook verified');
          if (txt.includes('_dmarc')) txtFindings.push('DMARC');
        }

        const mainEntity = this.normalizer.createEntity({
          type: 'domain',
          name: entity,
          description: `DNS: ${records.A.length} A, ${records.AAAA.length} AAAA, ${records.MX.length} MX, ${records.NS.length} NS`,
          attributes: {
            aRecords: records.A,
            aaaaRecords: records.AAAA,
            cnameRecords: records.CNAME,
            mxRecords: records.MX,
            txtRecords: flatTxt,
            nsRecords: records.NS,
            soaRecord: records.SOA,
            securityFindings: txtFindings,
            hasSPF: txtFindings.includes('SPF'),
            hasDMARC: txtFindings.includes('DMARC'),
          },
          sourceUrl: '',
          confidence: 0.95,
          tags: ['dns', ...txtFindings.map((f) => f.toLowerCase())],
        });
        entities.push(mainEntity);

        // Create entities for IP addresses
        for (const ip of records.A) {
          const ipEntity = this.normalizer.createEntity({
            type: 'ip',
            name: ip,
            attributes: { recordType: 'A' },
            confidence: 0.95,
            tags: ['dns-a-record'],
          });
          entities.push(ipEntity);
          relationships.push(
            this.normalizer.createRelationship({
              sourceEntityId: mainEntity.id,
              targetEntityId: ipEntity.id,
              type: 'resolves_to',
              label: 'A record',
              confidence: 0.95,
            })
          );
        }

        for (const ip of records.AAAA) {
          const ipEntity = this.normalizer.createEntity({
            type: 'ip',
            name: ip,
            attributes: { recordType: 'AAAA' },
            confidence: 0.95,
            tags: ['dns-aaaa-record'],
          });
          entities.push(ipEntity);
          relationships.push(
            this.normalizer.createRelationship({
              sourceEntityId: mainEntity.id,
              targetEntityId: ipEntity.id,
              type: 'resolves_to',
              label: 'AAAA record',
              confidence: 0.95,
            })
          );
        }

        // MX entities
        for (const mx of records.MX) {
          const mxEntity = this.normalizer.createEntity({
            type: 'domain',
            name: mx.exchange,
            attributes: { priority: mx.priority, recordType: 'MX' },
            confidence: 0.9,
            tags: ['mail-server', 'mx-record'],
          });
          entities.push(mxEntity);
          relationships.push(
            this.normalizer.createRelationship({
              sourceEntityId: mainEntity.id,
              targetEntityId: mxEntity.id,
              type: 'uses',
              label: `MX (priority ${mx.priority})`,
              confidence: 0.95,
            })
          );
        }

        // NS entities
        for (const ns of records.NS) {
          const nsEntity = this.normalizer.createEntity({
            type: 'domain',
            name: ns,
            attributes: { recordType: 'NS' },
            confidence: 0.9,
            tags: ['nameserver', 'ns-record'],
          });
          entities.push(nsEntity);
          relationships.push(
            this.normalizer.createRelationship({
              sourceEntityId: mainEntity.id,
              targetEntityId: nsEntity.id,
              type: 'uses',
              label: 'nameserver',
              confidence: 0.95,
            })
          );
        }
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    return [];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.resolver.resolve4('example.com');
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'DNS resolution failed' };
    }
  }
}
