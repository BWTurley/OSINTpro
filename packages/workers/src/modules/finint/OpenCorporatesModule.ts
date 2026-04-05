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

interface OcCompany {
  name: string;
  company_number: string;
  jurisdiction_code: string;
  incorporation_date: string;
  dissolution_date: string | null;
  company_type: string;
  registry_url: string;
  branch: string | null;
  current_status: string;
  opencorporates_url: string;
  registered_address_in_full: string | null;
  officers?: Array<{
    officer: {
      name: string;
      position: string;
      start_date: string;
      end_date: string | null;
    };
  }>;
}

export class OpenCorporatesModule extends BaseModule {
  name = 'opencorporates';
  category = 'finint' as const;
  supportedEntityTypes = ['organization'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 1, refillInterval: 1000 };
  cacheTTL = 86400;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.opencorporates.com/v0.4';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('opencorporates');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'organization', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        const params: Record<string, string> = { q: entity };
        if (apiKey) params['api_token'] = apiKey;

        const searchResult = await this.makeRequest<{
          results: {
            companies: Array<{ company: OcCompany }>;
            total_count: number;
          };
        }>({
          url: `${this.baseUrl}/companies/search`,
          method: 'GET',
          params,
        });
        apiCalls++;
        rawData['search'] = searchResult;

        for (const item of searchResult.results.companies.slice(0, 10)) {
          const company = item.company;

          const companyEntity = this.normalizer.createEntity({
            type: 'organization',
            name: company.name,
            description: `${company.company_type || 'Company'} in ${company.jurisdiction_code}`,
            attributes: {
              companyNumber: company.company_number,
              jurisdictionCode: company.jurisdiction_code,
              incorporationDate: company.incorporation_date,
              dissolutionDate: company.dissolution_date,
              companyType: company.company_type,
              currentStatus: company.current_status,
              registryUrl: company.registry_url,
              registeredAddress: company.registered_address_in_full,
              branch: company.branch,
            },
            sourceUrl: company.opencorporates_url,
            confidence: 0.85,
            tags: ['corporate-registry', company.jurisdiction_code],
          });
          entities.push(companyEntity);

          if (company.officers) {
            for (const officerItem of company.officers) {
              const officer = officerItem.officer;
              const officerEntity = this.normalizer.createEntity({
                type: 'person',
                name: officer.name,
                attributes: {
                  position: officer.position,
                  startDate: officer.start_date,
                  endDate: officer.end_date,
                },
                sourceUrl: company.opencorporates_url,
                confidence: 0.8,
                tags: ['corporate-officer'],
              });
              entities.push(officerEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: companyEntity.id,
                  targetEntityId: officerEntity.id,
                  type: 'employs',
                  label: officer.position,
                  confidence: 0.85,
                })
              );
            }
          }
        }
      } catch (err) {
        errors.push(this.buildError('SEARCH_ERROR', `OpenCorporates search failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const search = data['search'] as { results: { companies: Array<{ company: OcCompany }> } } | undefined;
    if (!search) return [];

    return search.results.companies.map((item) =>
      this.normalizer.createEntity({
        type: 'organization',
        name: item.company.name,
        attributes: {
          companyNumber: item.company.company_number,
          jurisdiction: item.company.jurisdiction_code,
          status: item.company.current_status,
        },
        sourceUrl: item.company.opencorporates_url,
        tags: ['corporate-registry'],
      })
    );
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: `${this.baseUrl}/companies/search`,
        method: 'GET',
        params: { q: 'Apple' },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'OpenCorporates API unreachable' };
    }
  }
}
