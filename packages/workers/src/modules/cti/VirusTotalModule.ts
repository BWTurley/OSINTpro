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

interface VtAttributes {
  last_analysis_stats: { malicious: number; suspicious: number; undetected: number; harmless: number; timeout: number };
  last_analysis_date?: number;
  reputation?: number;
  tags?: string[];
  [key: string]: unknown;
}

interface VtResponse {
  data: {
    id: string;
    type: string;
    attributes: VtAttributes;
  };
}

export class VirusTotalModule extends BaseModule {
  name = 'virustotal';
  category = 'cti' as const;
  supportedEntityTypes = ['hash', 'url', 'domain', 'ip'];
  rateLimit: RateLimitConfig = { maxTokens: 4, refillRate: 4, refillInterval: 60000 };
  cacheTTL = 1800;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://www.virustotal.com/api/v3';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('virustotal');
  }

  private detectType(entity: string): 'files' | 'urls' | 'domains' | 'ip_addresses' {
    if (/^[a-fA-F0-9]{32}$/.test(entity)) return 'files'; // MD5
    if (/^[a-fA-F0-9]{40}$/.test(entity)) return 'files'; // SHA1
    if (/^[a-fA-F0-9]{64}$/.test(entity)) return 'files'; // SHA256
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entity)) return 'ip_addresses';
    if (entity.startsWith('http://') || entity.startsWith('https://')) return 'urls';
    return 'domains';
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false,
        module: this.name,
        entity,
        entityType: 'hash',
        timestamp: new Date().toISOString(),
        rawData: null,
        normalized: [],
        relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'VirusTotal API key is required', false)],
      };
    }

    return this.executeWithCache(entity, 'hash', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const vtType = this.detectType(entity);
      const headers = { 'x-apikey': apiKey };

      try {
        let lookupUrl: string;
        if (vtType === 'urls') {
          const urlId = Buffer.from(entity).toString('base64url');
          lookupUrl = `${this.baseUrl}/urls/${urlId}`;
        } else {
          lookupUrl = `${this.baseUrl}/${vtType}/${entity}`;
        }

        const result = await this.makeRequest<VtResponse>({
          url: lookupUrl,
          method: 'GET',
          headers,
        });
        apiCalls++;
        rawData['report'] = result;

        const attrs = result.data.attributes;
        const stats = attrs.last_analysis_stats;
        const totalEngines = stats.malicious + stats.suspicious + stats.undetected + stats.harmless + stats.timeout;
        const detectionRate = totalEngines > 0 ? (stats.malicious + stats.suspicious) / totalEngines : 0;

        const entityTypeMap: Record<string, 'hash' | 'url' | 'domain' | 'ip'> = {
          files: 'hash',
          urls: 'url',
          domains: 'domain',
          ip_addresses: 'ip',
        };

        const mainEntity = this.normalizer.createEntity({
          type: entityTypeMap[vtType] || 'indicator',
          name: entity,
          description: `VT Detection: ${stats.malicious}/${totalEngines} engines (${(detectionRate * 100).toFixed(1)}%)`,
          attributes: {
            analysisStats: stats,
            detectionRate,
            totalEngines,
            reputation: attrs.reputation,
            tags: attrs.tags || [],
            lastAnalysisDate: attrs.last_analysis_date
              ? new Date(attrs.last_analysis_date * 1000).toISOString()
              : null,
            ...(vtType === 'files'
              ? {
                  md5: (attrs as Record<string, unknown>)['md5'],
                  sha1: (attrs as Record<string, unknown>)['sha1'],
                  sha256: (attrs as Record<string, unknown>)['sha256'],
                  size: (attrs as Record<string, unknown>)['size'],
                  type: (attrs as Record<string, unknown>)['type_description'],
                  names: (attrs as Record<string, unknown>)['names'],
                }
              : {}),
            ...(vtType === 'domains'
              ? {
                  registrar: (attrs as Record<string, unknown>)['registrar'],
                  creationDate: (attrs as Record<string, unknown>)['creation_date'],
                  lastDnsRecords: (attrs as Record<string, unknown>)['last_dns_records'],
                  categories: (attrs as Record<string, unknown>)['categories'],
                }
              : {}),
            ...(vtType === 'ip_addresses'
              ? {
                  asOwner: (attrs as Record<string, unknown>)['as_owner'],
                  asn: (attrs as Record<string, unknown>)['asn'],
                  country: (attrs as Record<string, unknown>)['country'],
                  network: (attrs as Record<string, unknown>)['network'],
                }
              : {}),
          },
          sourceUrl: `https://www.virustotal.com/gui/${vtType.replace('_', '-')}/${entity}`,
          confidence: 0.95,
          tags: [
            'virustotal',
            stats.malicious > 0 ? 'malicious' : 'clean',
            ...(attrs.tags || []),
          ],
        });
        entities.push(mainEntity);

        // Fetch relationships for files (communicating files, contacted domains, etc.)
        if (vtType === 'files' && stats.malicious > 0) {
          for (const relType of ['contacted_domains', 'contacted_ips', 'contacted_urls']) {
            try {
              const relResult = await this.makeRequest<{
                data: Array<{ id: string; type: string; attributes: Record<string, unknown> }>;
              }>({
                url: `${this.baseUrl}/files/${entity}/${relType}`,
                method: 'GET',
                headers,
                params: { limit: 10 },
              });
              apiCalls++;
              rawData[relType] = relResult;

              for (const item of relResult.data) {
                const relEntityType = relType === 'contacted_domains' ? 'domain' : relType === 'contacted_ips' ? 'ip' : 'url';
                const relEntity = this.normalizer.createEntity({
                  type: relEntityType,
                  name: item.id,
                  attributes: item.attributes,
                  confidence: 0.8,
                  tags: ['virustotal', 'malware-contact'],
                });
                entities.push(relEntity);
                relationships.push(
                  this.normalizer.createRelationship({
                    sourceEntityId: mainEntity.id,
                    targetEntityId: relEntity.id,
                    type: 'communicates_with',
                    label: relType.replace('_', ' '),
                    confidence: 0.85,
                  })
                );
              }
            } catch {
              // Relationship data is supplementary
            }
          }
        }
      } catch (err) {
        errors.push(this.buildError('VT_ERROR', `VirusTotal lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const report = data['report'] as VtResponse | undefined;
    if (!report) return [];

    return [
      this.normalizer.createEntity({
        type: 'indicator',
        name: report.data.id,
        attributes: { stats: report.data.attributes.last_analysis_stats },
        tags: ['virustotal'],
      }),
    ];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      // VT requires API key even for health check, so just check connectivity
      await this.httpClient.get(`${this.baseUrl}/metadata`, {
        timeout: 5000,
        validateStatus: () => true,
      });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'VirusTotal unreachable' };
    }
  }
}
