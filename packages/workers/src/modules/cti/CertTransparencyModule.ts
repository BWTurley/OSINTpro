import Redis from 'ioredis';
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

interface CrtShEntry {
  id: number;
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  not_before: string;
  not_after: string;
  serial_number: string;
  result_count: number;
  entry_timestamp: string;
}

export class CertTransparencyModule extends BaseModule {
  name = 'cert-transparency';
  category = 'cti' as const;
  supportedEntityTypes = ['domain'];
  rateLimit: RateLimitConfig = { maxTokens: 3, refillRate: 1, refillInterval: 2000 };
  cacheTTL = 7200;
  requiresApiKey = false;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('cert-transparency');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'domain', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        const certs = await this.makeRequest<CrtShEntry[]>({
          url: 'https://crt.sh/',
          method: 'GET',
          params: {
            q: `%.${entity}`,
            output: 'json',
          },
          timeout: 30000,
        });
        apiCalls++;
        rawData['certs'] = certs;

        // Deduplicate by common_name
        const seenDomains = new Set<string>();
        const seenIssuers = new Map<string, string>();

        const mainDomainEntity = this.normalizer.createEntity({
          type: 'domain',
          name: entity,
          description: `${certs.length} certificates found in CT logs`,
          attributes: {
            totalCerts: certs.length,
            uniqueSubdomains: new Set(certs.map((c) => c.common_name.toLowerCase())).size,
          },
          sourceUrl: `https://crt.sh/?q=%.${entity}`,
          confidence: 0.95,
          tags: ['cert-transparency', 'domain'],
        });
        entities.push(mainDomainEntity);

        for (const cert of certs) {
          const names = cert.name_value.split('\n').map((n) => n.trim().toLowerCase());
          for (const name of names) {
            if (name && !seenDomains.has(name) && name !== entity.toLowerCase()) {
              seenDomains.add(name);

              const subEntity = this.normalizer.createEntity({
                type: 'domain',
                name,
                description: `Found via CT log, issuer: ${cert.issuer_name}`,
                attributes: {
                  notBefore: cert.not_before,
                  notAfter: cert.not_after,
                  issuerName: cert.issuer_name,
                  serialNumber: cert.serial_number,
                  certId: cert.id,
                },
                sourceUrl: `https://crt.sh/?id=${cert.id}`,
                confidence: 0.85,
                tags: ['ct-subdomain', 'certificate'],
              });
              entities.push(subEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: mainDomainEntity.id,
                  targetEntityId: subEntity.id,
                  type: 'parent_of',
                  label: 'parent domain',
                  confidence: 0.9,
                })
              );
            }
          }

          // Track unique issuers
          if (!seenIssuers.has(cert.issuer_name)) {
            const issuerEntity = this.normalizer.createEntity({
              type: 'organization',
              name: cert.issuer_name,
              attributes: { issuerCaId: cert.issuer_ca_id },
              confidence: 0.8,
              tags: ['certificate-authority'],
            });
            seenIssuers.set(cert.issuer_name, issuerEntity.id);
            entities.push(issuerEntity);
          }

          const issuerId = seenIssuers.get(cert.issuer_name);
          if (issuerId) {
            const certEntity = this.normalizer.createEntity({
              type: 'certificate',
              name: `${cert.common_name} (${cert.serial_number})`,
              attributes: {
                certId: cert.id,
                commonName: cert.common_name,
                serialNumber: cert.serial_number,
                notBefore: cert.not_before,
                notAfter: cert.not_after,
                issuerName: cert.issuer_name,
                nameValue: cert.name_value,
                entryTimestamp: cert.entry_timestamp,
              },
              sourceUrl: `https://crt.sh/?id=${cert.id}`,
              confidence: 0.95,
              tags: ['x509-certificate'],
            });
            entities.push(certEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: certEntity.id,
                targetEntityId: issuerId,
                type: 'signed_by',
                label: 'issued by',
                confidence: 0.95,
              })
            );
          }

          // Cap entities to avoid huge result sets
          if (entities.length > 200) break;
        }
      } catch (err) {
        errors.push(this.buildError('CRT_SH_ERROR', `crt.sh lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const certs = (data['certs'] || []) as CrtShEntry[];
    const seen = new Set<string>();

    return certs
      .filter((c) => {
        if (seen.has(c.common_name)) return false;
        seen.add(c.common_name);
        return true;
      })
      .slice(0, 50)
      .map((c) =>
        this.normalizer.createEntity({
          type: 'domain',
          name: c.common_name,
          attributes: { issuer: c.issuer_name, notAfter: c.not_after },
          tags: ['ct-log'],
        })
      );
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({ url: 'https://crt.sh/?q=example.com&output=json', method: 'GET' }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'crt.sh unreachable' };
    }
  }
}
