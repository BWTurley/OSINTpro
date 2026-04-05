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

interface FrDocument {
  document_number: string;
  title: string;
  type: string;
  abstract: string;
  html_url: string;
  pdf_url: string;
  publication_date: string;
  agencies: Array<{ name: string; raw_name: string; id: number; url: string }>;
  action: string;
  dates: string;
  docket_ids: string[];
  regulation_id_numbers: Array<{ regulation_id_number: string }>;
  significant: boolean;
  citation: string;
  start_page: number;
  end_page: number;
  page_length: number;
  subtype: string;
  topics: string[];
  comments_close_on: string | null;
  effective_on: string | null;
}

export class FederalRegisterModule extends BaseModule {
  name = 'federal-register';
  category = 'political' as const;
  supportedEntityTypes = ['organization', 'person'];
  rateLimit: RateLimitConfig = { maxTokens: 20, refillRate: 20, refillInterval: 60000 };
  cacheTTL = 3600;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private baseUrl = 'https://www.federalregister.gov/api/v1';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('federal-register');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'organization', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        const searchResult = await this.makeRequest<{
          count: number;
          results: FrDocument[];
        }>({
          url: `${this.baseUrl}/documents.json`,
          method: 'GET',
          params: {
            'conditions[term]': entity,
            per_page: 20,
            order: 'newest',
            'fields[]': [
              'document_number', 'title', 'type', 'abstract', 'html_url', 'pdf_url',
              'publication_date', 'agencies', 'action', 'dates', 'docket_ids',
              'regulation_id_numbers', 'significant', 'citation', 'start_page',
              'end_page', 'page_length', 'subtype', 'topics', 'comments_close_on',
              'effective_on',
            ],
          },
        });
        apiCalls++;
        rawData['search'] = searchResult;

        for (const doc of searchResult.results) {
          const docEntity = this.normalizer.createEntity({
            type: 'filing',
            name: doc.title.slice(0, 200),
            description: doc.abstract?.slice(0, 500) || '',
            attributes: {
              documentNumber: doc.document_number,
              type: doc.type,
              subtype: doc.subtype,
              publicationDate: doc.publication_date,
              action: doc.action,
              dates: doc.dates,
              citation: doc.citation,
              significant: doc.significant,
              docketIds: doc.docket_ids,
              regulationIds: doc.regulation_id_numbers?.map((r) => r.regulation_id_number),
              startPage: doc.start_page,
              endPage: doc.end_page,
              pageLength: doc.page_length,
              topics: doc.topics,
              commentsCloseOn: doc.comments_close_on,
              effectiveOn: doc.effective_on,
              pdfUrl: doc.pdf_url,
            },
            sourceUrl: doc.html_url,
            confidence: 0.95,
            tags: ['federal-register', doc.type.toLowerCase(), ...(doc.significant ? ['significant'] : [])],
          });
          entities.push(docEntity);

          for (const agency of doc.agencies) {
            const agencyEntity = this.normalizer.createEntity({
              type: 'organization',
              name: agency.name || agency.raw_name,
              attributes: { agencyId: agency.id, agencyUrl: agency.url },
              confidence: 0.9,
              tags: ['federal-agency'],
            });
            entities.push(agencyEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: agencyEntity.id,
                targetEntityId: docEntity.id,
                type: 'references',
                label: 'published',
                confidence: 0.95,
              })
            );
          }
        }
      } catch (err) {
        errors.push(this.buildError('FR_ERROR', `Federal Register search failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({ url: `${this.baseUrl}/documents.json`, method: 'GET', params: { per_page: 1 } }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Federal Register API unreachable' };
    }
  }
}
