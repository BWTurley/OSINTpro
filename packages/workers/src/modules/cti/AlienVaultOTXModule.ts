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

interface OtxPulse {
  id: string;
  name: string;
  description: string;
  author_name: string;
  created: string;
  modified: string;
  tags: string[];
  targeted_countries: string[];
  malware_families: string[];
  attack_ids: Array<{ id: string; name: string; display_name: string }>;
  references: string[];
  indicators: Array<{
    id: number;
    indicator: string;
    type: string;
    created: string;
    title: string;
    description: string;
  }>;
  TLP: string;
  adversary: string;
}

interface OtxIndicatorResult {
  pulse_info: {
    count: number;
    pulses: OtxPulse[];
  };
  general?: {
    whois?: string;
    reputation?: number;
    sections?: string[];
  };
  geo?: {
    country_code: string;
    country_name: string;
    city: string;
    latitude: number;
    longitude: number;
    asn: string;
  };
  malware?: {
    data: Array<{ hash: string; detections: Record<string, string> }>;
  };
  passive_dns?: Array<{ hostname: string; address: string; first: string; last: string; record_type: string }>;
}

export class AlienVaultOTXModule extends BaseModule {
  name = 'alienvault-otx';
  category = 'cti' as const;
  supportedEntityTypes = ['ip', 'domain', 'hash', 'url'];
  rateLimit: RateLimitConfig = { maxTokens: 10, refillRate: 10, refillInterval: 60000 };
  cacheTTL = 1800;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://otx.alienvault.com/api/v1';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('alienvault-otx');
  }

  private detectType(entity: string): { section: string; type: string } {
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entity)) return { section: 'IPv4', type: 'ip' };
    if (/^[a-fA-F0-9]{32}$/.test(entity)) return { section: 'file', type: 'hash' };
    if (/^[a-fA-F0-9]{64}$/.test(entity)) return { section: 'file', type: 'hash' };
    if (entity.startsWith('http')) return { section: 'url', type: 'url' };
    return { section: 'domain', type: 'domain' };
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false,
        module: this.name,
        entity,
        entityType: 'indicator',
        timestamp: new Date().toISOString(),
        rawData: null,
        normalized: [],
        relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'AlienVault OTX API key required', false)],
      };
    }

    return this.executeWithCache(entity, 'indicator', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const { section, type } = this.detectType(entity);
      const headers = { 'X-OTX-API-KEY': apiKey };

      try {
        const generalResult = await this.makeRequest<OtxIndicatorResult>({
          url: `${this.baseUrl}/indicators/${section}/${entity}/general`,
          method: 'GET',
          headers,
        });
        apiCalls++;
        rawData['general'] = generalResult;

        const mainEntity = this.normalizer.createEntity({
          type: type as 'ip' | 'domain' | 'hash' | 'url',
          name: entity,
          description: `OTX: ${generalResult.pulse_info.count} pulses`,
          attributes: {
            pulseCount: generalResult.pulse_info.count,
            reputation: generalResult.general?.reputation,
            geo: generalResult.geo || null,
          },
          sourceUrl: `https://otx.alienvault.com/indicator/${section}/${entity}`,
          confidence: 0.85,
          tags: ['otx', 'threat-intel'],
        });
        entities.push(mainEntity);

        for (const pulse of generalResult.pulse_info.pulses.slice(0, 10)) {
          const pulseEntity = this.normalizer.createEntity({
            type: 'campaign',
            name: pulse.name,
            description: pulse.description?.slice(0, 500) || '',
            attributes: {
              pulseId: pulse.id,
              author: pulse.author_name,
              created: pulse.created,
              modified: pulse.modified,
              tags: pulse.tags,
              targetedCountries: pulse.targeted_countries,
              malwareFamilies: pulse.malware_families,
              attackIds: pulse.attack_ids,
              references: pulse.references,
              tlp: pulse.TLP,
              adversary: pulse.adversary,
              indicatorCount: pulse.indicators?.length || 0,
            },
            sourceUrl: `https://otx.alienvault.com/pulse/${pulse.id}`,
            confidence: 0.8,
            tags: ['otx-pulse', ...pulse.tags.slice(0, 10)],
          });
          entities.push(pulseEntity);

          relationships.push(
            this.normalizer.createRelationship({
              sourceEntityId: mainEntity.id,
              targetEntityId: pulseEntity.id,
              type: 'part_of',
              label: 'referenced in pulse',
              confidence: 0.85,
            })
          );
        }

        // Fetch passive DNS for IP/domain
        if (type === 'ip' || type === 'domain') {
          try {
            const pdnsResult = await this.makeRequest<{
              passive_dns: Array<{ hostname: string; address: string; first: string; last: string; record_type: string }>;
            }>({
              url: `${this.baseUrl}/indicators/${section}/${entity}/passive_dns`,
              method: 'GET',
              headers,
            });
            apiCalls++;
            rawData['passive_dns'] = pdnsResult;

            for (const record of (pdnsResult.passive_dns || []).slice(0, 20)) {
              const targetType = type === 'ip' ? 'domain' : 'ip';
              const targetName = type === 'ip' ? record.hostname : record.address;
              if (!targetName) continue;

              const dnsEntity = this.normalizer.createEntity({
                type: targetType,
                name: targetName,
                attributes: {
                  recordType: record.record_type,
                  firstSeen: record.first,
                  lastSeen: record.last,
                },
                confidence: 0.75,
                tags: ['passive-dns', 'otx'],
              });
              entities.push(dnsEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: mainEntity.id,
                  targetEntityId: dnsEntity.id,
                  type: 'resolves_to',
                  label: `passive DNS (${record.record_type})`,
                  confidence: 0.8,
                })
              );
            }
          } catch {
            // Passive DNS is supplementary
          }
        }
      } catch (err) {
        errors.push(this.buildError('OTX_ERROR', `OTX lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const general = data['general'] as OtxIndicatorResult | undefined;
    if (!general) return [];

    return general.pulse_info.pulses.map((p) =>
      this.normalizer.createEntity({
        type: 'campaign',
        name: p.name,
        attributes: { pulseId: p.id, tags: p.tags },
        tags: ['otx-pulse'],
      })
    );
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(`${this.baseUrl}/pulses/activity`, {
        timeout: 5000,
        validateStatus: () => true,
      });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'AlienVault OTX unreachable' };
    }
  }
}
