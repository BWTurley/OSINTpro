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

interface StDomainInfo {
  hostname: string;
  alexa_rank: number;
  current_dns: Record<string, { values: Array<{ ip?: string; ip_organization?: string; hostname?: string }> }>;
  endpoint: string;
}

interface StSubdomains {
  subdomains: string[];
  endpoint: string;
}

interface StHistoryRecord {
  type: string;
  values: Array<{ ip: string; ip_organization: string }>;
  first_seen: string;
  last_seen: string;
}

export class SecurityTrailsModule extends BaseModule {
  name = 'securitytrails';
  category = 'domain' as const;
  supportedEntityTypes = ['domain', 'ip'];
  rateLimit: RateLimitConfig = { maxTokens: 2, refillRate: 2, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.securitytrails.com/v1';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('securitytrails');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false,
        module: this.name,
        entity,
        entityType: 'domain',
        timestamp: new Date().toISOString(),
        rawData: null,
        normalized: [],
        relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'SecurityTrails API key required', false)],
      };
    }

    return this.executeWithCache(entity, 'domain', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const headers = { APIKEY: apiKey, Accept: 'application/json' };
      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entity);

      if (isIp) {
        // IP search - find domains hosted on this IP
        try {
          const searchResult = await this.makeRequest<{
            records: Array<{ hostname: string; host_provider: string[]; computed: { type: string } }>;
            record_count: number;
          }>({
            url: `${this.baseUrl}/search/list`,
            method: 'POST',
            headers,
            data: { filter: { ipv4: entity } },
          });
          apiCalls++;
          rawData['ipSearch'] = searchResult;

          const ipEntity = this.normalizer.createEntity({
            type: 'ip',
            name: entity,
            description: `${searchResult.record_count} domains hosted`,
            attributes: { hostedDomainCount: searchResult.record_count },
            confidence: 0.9,
            tags: ['securitytrails'],
          });
          entities.push(ipEntity);

          for (const record of searchResult.records.slice(0, 30)) {
            const domEntity = this.normalizer.createEntity({
              type: 'domain',
              name: record.hostname,
              attributes: { hostProvider: record.host_provider, type: record.computed.type },
              confidence: 0.85,
              tags: ['securitytrails', 'hosted-domain'],
            });
            entities.push(domEntity);
            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: ipEntity.id,
                targetEntityId: domEntity.id,
                type: 'hosts',
                label: 'hosts domain',
                confidence: 0.9,
              })
            );
          }
        } catch (err) {
          errors.push(this.buildError('ST_IP_SEARCH_ERROR', `SecurityTrails IP search failed: ${err}`));
        }
      } else {
        // Domain info
        try {
          const domainInfo = await this.makeRequest<StDomainInfo>({
            url: `${this.baseUrl}/domain/${entity}`,
            method: 'GET',
            headers,
          });
          apiCalls++;
          rawData['domainInfo'] = domainInfo;

          const currentIps = domainInfo.current_dns?.a?.values?.map((v) => v.ip).filter(Boolean) || [];
          const currentMx = domainInfo.current_dns?.mx?.values?.map((v) => v.hostname).filter(Boolean) || [];
          const currentNs = domainInfo.current_dns?.ns?.values?.map((v) => v.hostname).filter(Boolean) || [];

          const mainEntity = this.normalizer.createEntity({
            type: 'domain',
            name: entity,
            description: `SecurityTrails: Alexa rank ${domainInfo.alexa_rank || 'N/A'}`,
            attributes: {
              alexaRank: domainInfo.alexa_rank,
              currentIps,
              currentMx,
              currentNs,
              currentDns: domainInfo.current_dns,
            },
            sourceUrl: `https://securitytrails.com/domain/${entity}`,
            confidence: 0.9,
            tags: ['securitytrails'],
          });
          entities.push(mainEntity);

          for (const ip of currentIps) {
            if (!ip) continue;
            const ipEntity = this.normalizer.createEntity({
              type: 'ip',
              name: ip,
              confidence: 0.9,
              tags: ['current-dns'],
            });
            entities.push(ipEntity);
            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: mainEntity.id,
                targetEntityId: ipEntity.id,
                type: 'resolves_to',
                label: 'current A record',
                confidence: 0.95,
              })
            );
          }
        } catch (err) {
          errors.push(this.buildError('ST_DOMAIN_ERROR', `SecurityTrails domain info failed: ${err}`));
        }

        // Subdomains
        try {
          const subdomains = await this.makeRequest<StSubdomains>({
            url: `${this.baseUrl}/domain/${entity}/subdomains`,
            method: 'GET',
            headers,
            params: { children_only: 'false', include_inactive: 'true' },
          });
          apiCalls++;
          rawData['subdomains'] = subdomains;

          for (const sub of subdomains.subdomains.slice(0, 50)) {
            const fullDomain = `${sub}.${entity}`;
            const subEntity = this.normalizer.createEntity({
              type: 'domain',
              name: fullDomain,
              attributes: { parentDomain: entity },
              confidence: 0.85,
              tags: ['subdomain', 'securitytrails'],
            });
            entities.push(subEntity);
          }
        } catch (err) {
          errors.push(this.buildError('ST_SUBDOMAIN_ERROR', `Subdomain lookup failed: ${err}`));
        }

        // DNS history (A records)
        try {
          const history = await this.makeRequest<{
            records: StHistoryRecord[];
            type: string;
          }>({
            url: `${this.baseUrl}/history/${entity}/dns/a`,
            method: 'GET',
            headers,
          });
          apiCalls++;
          rawData['dnsHistory'] = history;

          for (const record of history.records.slice(0, 20)) {
            for (const val of record.values) {
              if (val.ip) {
                const histIp = this.normalizer.createEntity({
                  type: 'ip',
                  name: val.ip,
                  attributes: {
                    organization: val.ip_organization,
                    firstSeen: record.first_seen,
                    lastSeen: record.last_seen,
                    historical: true,
                  },
                  confidence: 0.8,
                  tags: ['historical-dns', 'securitytrails'],
                });
                entities.push(histIp);
              }
            }
          }
        } catch {
          // History is supplementary
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
      await this.httpClient.get(`${this.baseUrl}/ping`, {
        timeout: 5000,
        validateStatus: () => true,
      });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'SecurityTrails unreachable' };
    }
  }
}
