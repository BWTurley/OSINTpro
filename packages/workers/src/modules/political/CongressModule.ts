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

interface CongressMember {
  bioguideId: string;
  name: string;
  state: string;
  district?: number;
  partyName: string;
  chamber: string;
  url: string;
  depiction?: { imageUrl: string; attribution: string };
  terms: { item: Array<{ chamber: string; startYear: number; endYear?: number }> };
  updateDate: string;
}

interface CongressBill {
  congress: number;
  type: string;
  number: number;
  title: string;
  url: string;
  latestAction: { actionDate: string; text: string };
  introducedDate: string;
  originChamber: string;
  policyArea?: { name: string };
  sponsors: Array<{ bioguideId: string; fullName: string; party: string; state: string }>;
}

export class CongressModule extends BaseModule {
  name = 'congress';
  category = 'political' as const;
  supportedEntityTypes = ['person'];
  rateLimit: RateLimitConfig = { maxTokens: 50, refillRate: 50, refillInterval: 3600000 };
  cacheTTL = 43200;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.congress.gov/v3';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('congress');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false, module: this.name, entity, entityType: 'person',
        timestamp: new Date().toISOString(), rawData: null, normalized: [], relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'Congress.gov API key required', false)],
      };
    }

    return this.executeWithCache(entity, 'person', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const params = { api_key: apiKey, format: 'json' };

      // Search for members
      try {
        const memberSearch = await this.makeRequest<{
          members: CongressMember[];
        }>({
          url: `${this.baseUrl}/member`,
          method: 'GET',
          params: { ...params, query: entity, limit: 10 },
        });
        apiCalls++;
        rawData['memberSearch'] = memberSearch;

        for (const member of memberSearch.members || []) {
          const memberEntity = this.normalizer.createEntity({
            type: 'person',
            name: member.name,
            description: `${member.partyName} | ${member.state}${member.district ? `-${member.district}` : ''} | ${member.chamber}`,
            attributes: {
              bioguideId: member.bioguideId,
              state: member.state,
              district: member.district,
              party: member.partyName,
              chamber: member.chamber,
              imageUrl: member.depiction?.imageUrl,
              terms: member.terms?.item,
              updateDate: member.updateDate,
            },
            sourceUrl: member.url || `https://www.congress.gov/member/${member.bioguideId}`,
            confidence: 0.9,
            tags: ['congress', 'politician', member.partyName.toLowerCase(), member.state.toLowerCase()],
          });
          entities.push(memberEntity);

          // Get sponsored legislation
          try {
            const billsResult = await this.makeRequest<{
              sponsoredLegislation: CongressBill[];
            }>({
              url: `${this.baseUrl}/member/${member.bioguideId}/sponsored-legislation`,
              method: 'GET',
              params: { ...params, limit: 20 },
            });
            apiCalls++;
            rawData[`bills_${member.bioguideId}`] = billsResult;

            for (const bill of billsResult.sponsoredLegislation || []) {
              const billEntity = this.normalizer.createEntity({
                type: 'legislation',
                name: `${bill.type}${bill.number}: ${bill.title}`,
                description: bill.latestAction?.text || '',
                attributes: {
                  congress: bill.congress,
                  billType: bill.type,
                  billNumber: bill.number,
                  introducedDate: bill.introducedDate,
                  originChamber: bill.originChamber,
                  latestAction: bill.latestAction,
                  policyArea: bill.policyArea?.name,
                },
                sourceUrl: bill.url || `https://www.congress.gov/bill/${bill.congress}th-congress/${bill.originChamber.toLowerCase()}-bill/${bill.number}`,
                confidence: 0.95,
                tags: ['legislation', 'bill', ...(bill.policyArea ? [bill.policyArea.name.toLowerCase()] : [])],
              });
              entities.push(billEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: memberEntity.id,
                  targetEntityId: billEntity.id,
                  type: 'owns',
                  label: 'sponsored',
                  confidence: 0.95,
                })
              );
            }
          } catch {
            // Bills supplementary
          }
        }
      } catch (err) {
        errors.push(this.buildError('CONGRESS_ERROR', `Congress.gov member search failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(`${this.baseUrl}/bill`, { timeout: 5000, validateStatus: () => true });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Congress.gov API unreachable' };
    }
  }
}
