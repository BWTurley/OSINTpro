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

interface UsaSpendingAward {
  'Award ID': string;
  'Recipient Name': string;
  'Award Amount': number;
  Description: string;
  'Start Date': string;
  'End Date': string;
  'Awarding Agency': string;
  'Awarding Sub Agency': string;
  'Award Type': string;
  'Place of Performance City': string;
  'Place of Performance State': string;
  'Place of Performance Country': string;
  generated_internal_id: string;
}

export class FederalSpendingModule extends BaseModule {
  name = 'federal-spending';
  category = 'political' as const;
  supportedEntityTypes = ['organization', 'person'];
  rateLimit: RateLimitConfig = { maxTokens: 10, refillRate: 5, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.usaspending.gov/api/v2';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('federal-spending');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'organization', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      // Search awards (contracts + grants)
      try {
        const searchResult = await this.makeRequest<{
          results: Array<{
            internal_id: number;
            'Award ID': string;
            'Recipient Name': string;
            'Award Amount': number;
            Description: string;
            'Start Date': string;
            'End Date': string;
            'Awarding Agency': string;
            'Awarding Sub Agency': string;
            'Award Type': string;
            'Place of Performance City': string;
            'Place of Performance State Code': string;
            generated_internal_id: string;
          }>;
          page_metadata: { total: number; page: number; hasNext: boolean };
        }>({
          url: `${this.baseUrl}/search/spending_by_award/`,
          method: 'POST',
          data: {
            filters: {
              keywords: [entity],
              time_period: [
                { start_date: '2020-01-01', end_date: new Date().toISOString().split('T')[0] },
              ],
            },
            fields: [
              'Award ID', 'Recipient Name', 'Award Amount', 'Description',
              'Start Date', 'End Date', 'Awarding Agency', 'Awarding Sub Agency',
              'Award Type', 'Place of Performance City', 'Place of Performance State Code',
              'generated_internal_id',
            ],
            page: 1,
            limit: 25,
            sort: '-Award Amount',
            order: 'desc',
            subawards: false,
          },
        });
        apiCalls++;
        rawData['awards'] = searchResult;

        const totalAmount = searchResult.results.reduce((sum, a) => sum + (a['Award Amount'] || 0), 0);

        if (searchResult.results.length > 0) {
          const searchEntity = this.normalizer.createEntity({
            type: 'organization',
            name: entity,
            description: `USASpending: ${searchResult.page_metadata.total} awards totaling $${totalAmount.toLocaleString()}`,
            attributes: {
              totalAwards: searchResult.page_metadata.total,
              totalAmount,
            },
            sourceUrl: `https://www.usaspending.gov/search/?hash=keyword_${encodeURIComponent(entity)}`,
            confidence: 0.85,
            tags: ['federal-spending', 'usaspending'],
          });
          entities.push(searchEntity);

          for (const award of searchResult.results) {
            const awardEntity = this.normalizer.createEntity({
              type: 'contract',
              name: `${award['Award ID']}: ${award['Recipient Name']}`,
              description: award['Description']?.slice(0, 500) || '',
              attributes: {
                awardId: award['Award ID'],
                recipientName: award['Recipient Name'],
                amount: award['Award Amount'],
                startDate: award['Start Date'],
                endDate: award['End Date'],
                awardingAgency: award['Awarding Agency'],
                awardingSubAgency: award['Awarding Sub Agency'],
                awardType: award['Award Type'],
                performanceCity: award['Place of Performance City'],
                performanceState: award['Place of Performance State Code'],
                internalId: award.generated_internal_id,
              },
              sourceUrl: `https://www.usaspending.gov/award/${award.generated_internal_id}`,
              confidence: 0.95,
              tags: ['federal-award', award['Award Type'] || 'unknown'],
            });
            entities.push(awardEntity);

            if (award['Recipient Name']) {
              const recipientEntity = this.normalizer.createEntity({
                type: 'organization',
                name: award['Recipient Name'],
                attributes: {},
                confidence: 0.8,
                tags: ['federal-contractor'],
              });
              entities.push(recipientEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: recipientEntity.id,
                  targetEntityId: awardEntity.id,
                  type: 'finances',
                  label: 'received award',
                  confidence: 0.95,
                })
              );
            }

            if (award['Awarding Agency']) {
              const agencyEntity = this.normalizer.createEntity({
                type: 'organization',
                name: award['Awarding Agency'],
                attributes: { subAgency: award['Awarding Sub Agency'] },
                confidence: 0.9,
                tags: ['federal-agency'],
              });
              entities.push(agencyEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: agencyEntity.id,
                  targetEntityId: awardEntity.id,
                  type: 'finances',
                  label: 'awarded',
                  confidence: 0.95,
                })
              );
            }
          }
        }
      } catch (err) {
        errors.push(this.buildError('USASPENDING_ERROR', `USASpending search failed: ${err}`));
      }

      // Search recipients
      try {
        const recipientSearch = await this.makeRequest<{
          results: Array<{
            name: string;
            duns: string;
            uei: string;
            id: string;
            amount: number;
          }>;
        }>({
          url: `${this.baseUrl}/recipient/autocomplete/`,
          method: 'POST',
          data: { search_text: entity, limit: 10 },
        });
        apiCalls++;
        rawData['recipients'] = recipientSearch;
      } catch {
        // Autocomplete supplementary
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(`${this.baseUrl}/references/agency/`, { timeout: 5000 });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'USASpending API unreachable' };
    }
  }
}
