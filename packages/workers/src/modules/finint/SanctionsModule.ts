import { Redis } from 'ioredis';
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

interface OpenSanctionsEntity {
  id: string;
  caption: string;
  schema: string;
  properties: Record<string, string[]>;
  datasets: string[];
  first_seen: string;
  last_seen: string;
  last_change: string;
  referents: string[];
}

interface OpenSanctionsSearchResult {
  results: OpenSanctionsEntity[];
  total: number;
  limit: number;
  offset: number;
}

export class SanctionsModule extends BaseModule {
  name = 'sanctions';
  category = 'finint' as const;
  supportedEntityTypes = ['person', 'organization', 'vessel'];
  rateLimit: RateLimitConfig = { maxTokens: 10, refillRate: 2, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = false;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('sanctions');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'person', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      // OpenSanctions API (covers OFAC SDN, EU, UN, and more)
      try {
        const headers: Record<string, string> = {};
        if (apiKey) headers['Authorization'] = `ApiKey ${apiKey}`;

        const searchResult = await this.makeRequest<OpenSanctionsSearchResult>({
          url: 'https://api.opensanctions.org/search/default',
          method: 'GET',
          params: { q: entity, limit: 20 },
          headers,
        });
        apiCalls++;
        rawData['opensanctions'] = searchResult;

        for (const result of searchResult.results) {
          const props = result.properties;
          const entityType = result.schema === 'Person' ? 'person' : result.schema === 'Company' || result.schema === 'Organization' ? 'organization' : 'organization';

          const sanctionEntity = this.normalizer.createEntity({
            type: entityType,
            name: result.caption,
            description: `Sanctioned entity found in: ${result.datasets.join(', ')}`,
            attributes: {
              opensanctionsId: result.id,
              schema: result.schema,
              datasets: result.datasets,
              aliases: props['alias'] || [],
              nationalities: props['nationality'] || [],
              birthDates: props['birthDate'] || [],
              addresses: props['address'] || [],
              countries: props['country'] || [],
              idNumbers: props['idNumber'] || [],
              sanctions: props['sanction'] || [],
              programs: props['program'] || [],
              topics: props['topics'] || [],
              firstSeen: result.first_seen,
              lastChange: result.last_change,
            },
            sourceUrl: `https://www.opensanctions.org/entities/${result.id}/`,
            confidence: 0.9,
            tags: ['sanctions', ...result.datasets],
          });
          entities.push(sanctionEntity);
        }
      } catch (err) {
        errors.push(this.buildError('OPENSANCTIONS_ERROR', `OpenSanctions search failed: ${err}`));
      }

      // OFAC SDN list search (fallback/additional source)
      try {
        const ofacResult = await this.makeRequest<{
          results: Array<{
            name: string;
            type: string;
            programs: string[];
            addresses: Array<{ address: string; city: string; country: string }>;
            ids: Array<{ type: string; number: string; country: string }>;
            sdnType: string;
            remarks: string;
          }>;
        }>({
          url: 'https://sanctionssearch.ofac.treas.gov/api/search',
          method: 'GET',
          params: { name: entity, score: 85 },
        });
        apiCalls++;
        rawData['ofac'] = ofacResult;

        for (const result of (ofacResult.results || [])) {
          const existing = entities.find(
            (e) => e.name.toLowerCase() === result.name.toLowerCase()
          );

          if (!existing) {
            entities.push(
              this.normalizer.createEntity({
                type: result.sdnType === 'Individual' ? 'person' : 'organization',
                name: result.name,
                description: `OFAC SDN: ${result.programs?.join(', ') || 'unknown program'}`,
                attributes: {
                  sdnType: result.sdnType,
                  programs: result.programs,
                  addresses: result.addresses,
                  ids: result.ids,
                  remarks: result.remarks,
                },
                sourceUrl: 'https://sanctionssearch.ofac.treas.gov/',
                confidence: 0.85,
                tags: ['sanctions', 'ofac', 'sdn'],
              })
            );
          }
        }
      } catch {
        // OFAC search is supplementary, don't error
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const search = data['opensanctions'] as OpenSanctionsSearchResult | undefined;
    if (!search) return [];

    return search.results.map((r) =>
      this.normalizer.createEntity({
        type: r.schema === 'Person' ? 'person' : 'organization',
        name: r.caption,
        attributes: { datasets: r.datasets },
        tags: ['sanctions'],
      })
    );
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: 'https://api.opensanctions.org/search/default',
        method: 'GET',
        params: { q: 'test', limit: 1 },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Sanctions API unreachable' };
    }
  }
}
