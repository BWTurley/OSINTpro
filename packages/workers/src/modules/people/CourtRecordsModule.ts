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

interface ClOpinion {
  id: number;
  absolute_url: string;
  cluster: string;
  cluster_id: number;
  court: string;
  court_id: string;
  date_created: string;
  date_modified: string;
  date_filed: string;
  author: string;
  author_str: string;
  per_curiam: boolean;
  type: string;
  download_url: string;
  case_name: string;
  case_name_short: string;
  citation_count: number;
  snippet: string;
}

interface ClDocket {
  id: number;
  absolute_url: string;
  case_name: string;
  case_name_short: string;
  court: string;
  court_id: string;
  date_created: string;
  date_filed: string;
  date_terminated: string | null;
  docket_number: string;
  nature_of_suit: string;
  cause: string;
  assigned_to_str: string;
  referred_to_str: string;
}

export class CourtRecordsModule extends BaseModule {
  name = 'court-records';
  category = 'people' as const;
  supportedEntityTypes = ['person', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 2, refillInterval: 1000 };
  cacheTTL = 86400;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://www.courtlistener.com/api/rest/v4';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('court-records');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false, module: this.name, entity, entityType: 'person',
        timestamp: new Date().toISOString(), rawData: null, normalized: [], relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'CourtListener API key required', false)],
      };
    }

    return this.executeWithCache(entity, 'person', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const headers = { Authorization: `Token ${apiKey}` };

      // Search opinions
      try {
        const opinionsResult = await this.makeRequest<{
          count: number;
          results: ClOpinion[];
        }>({
          url: `${this.baseUrl}/search/`,
          method: 'GET',
          params: {
            q: entity,
            type: 'o',
            order_by: 'score desc',
            page_size: 20,
          },
          headers,
        });
        apiCalls++;
        rawData['opinions'] = opinionsResult;

        for (const opinion of opinionsResult.results) {
          const opEntity = this.normalizer.createEntity({
            type: 'filing',
            name: opinion.case_name || opinion.case_name_short,
            description: opinion.snippet?.replace(/<[^>]*>/g, '').slice(0, 500) || '',
            attributes: {
              courtListenerId: opinion.id,
              court: opinion.court,
              courtId: opinion.court_id,
              dateFiled: opinion.date_filed,
              author: opinion.author_str,
              perCuriam: opinion.per_curiam,
              opinionType: opinion.type,
              citationCount: opinion.citation_count,
              downloadUrl: opinion.download_url,
            },
            sourceUrl: `https://www.courtlistener.com${opinion.absolute_url}`,
            confidence: 0.85,
            tags: ['court-opinion', opinion.court_id],
          });
          entities.push(opEntity);
        }
      } catch (err) {
        errors.push(this.buildError('OPINION_SEARCH_ERROR', `Opinion search failed: ${err}`));
      }

      // Search dockets
      try {
        const docketsResult = await this.makeRequest<{
          count: number;
          results: ClDocket[];
        }>({
          url: `${this.baseUrl}/search/`,
          method: 'GET',
          params: {
            q: entity,
            type: 'r',
            order_by: 'score desc',
            page_size: 20,
          },
          headers,
        });
        apiCalls++;
        rawData['dockets'] = docketsResult;

        for (const docket of docketsResult.results) {
          const docketEntity = this.normalizer.createEntity({
            type: 'filing',
            name: docket.case_name || docket.case_name_short,
            description: `${docket.nature_of_suit || ''} | Docket #${docket.docket_number}`,
            attributes: {
              courtListenerId: docket.id,
              court: docket.court,
              courtId: docket.court_id,
              dateFiled: docket.date_filed,
              dateTerminated: docket.date_terminated,
              docketNumber: docket.docket_number,
              natureOfSuit: docket.nature_of_suit,
              cause: docket.cause,
              assignedTo: docket.assigned_to_str,
              referredTo: docket.referred_to_str,
            },
            sourceUrl: `https://www.courtlistener.com${docket.absolute_url}`,
            confidence: 0.85,
            tags: ['court-docket', docket.court_id, ...(docket.nature_of_suit ? [docket.nature_of_suit] : [])],
          });
          entities.push(docketEntity);
        }
      } catch (err) {
        errors.push(this.buildError('DOCKET_SEARCH_ERROR', `Docket search failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(`${this.baseUrl}/courts/`, { timeout: 5000, validateStatus: () => true });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'CourtListener unreachable' };
    }
  }
}
