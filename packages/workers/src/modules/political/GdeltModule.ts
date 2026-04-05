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

interface GdeltArticle {
  url: string;
  url_mobile: string;
  title: string;
  seendate: string;
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltDocResponse {
  articles: GdeltArticle[];
  summary?: {
    timeline?: Array<{ date: string; count: number }>;
    themes?: Array<{ name: string; count: number }>;
    locations?: Array<{ name: string; count: number; latitude: number; longitude: number }>;
    persons?: Array<{ name: string; count: number }>;
    organizations?: Array<{ name: string; count: number }>;
    tones?: { avg: number; count: number };
  };
}

export class GdeltModule extends BaseModule {
  name = 'gdelt';
  category = 'political' as const;
  supportedEntityTypes = ['person', 'organization', 'country', 'event'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 1, refillInterval: 5000 };
  cacheTTL = 1800;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.gdeltproject.org/api/v2/doc/doc';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('gdelt');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'event', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        // Article search
        const articleResult = await this.makeRequest<GdeltDocResponse>({
          url: this.baseUrl,
          method: 'GET',
          params: {
            query: entity,
            mode: 'ArtList',
            maxrecords: 50,
            format: 'json',
            sort: 'DateDesc',
            timespan: '3months',
          },
        });
        apiCalls++;
        rawData['articles'] = articleResult;

        // Timeline search
        let timelineResult: GdeltDocResponse | null = null;
        try {
          timelineResult = await this.makeRequest<GdeltDocResponse>({
            url: this.baseUrl,
            method: 'GET',
            params: {
              query: entity,
              mode: 'TimelineVol',
              format: 'json',
              timespan: '3months',
            },
          });
          apiCalls++;
          rawData['timeline'] = timelineResult;
        } catch {
          // Timeline supplementary
        }

        // Tone search
        let toneResult: GdeltDocResponse | null = null;
        try {
          toneResult = await this.makeRequest<GdeltDocResponse>({
            url: this.baseUrl,
            method: 'GET',
            params: {
              query: entity,
              mode: 'ToneChart',
              format: 'json',
              timespan: '3months',
            },
          });
          apiCalls++;
          rawData['tone'] = toneResult;
        } catch {
          // Tone supplementary
        }

        const articles = articleResult.articles || [];
        const domainCounts = new Map<string, number>();
        const countryCounts = new Map<string, number>();

        for (const article of articles) {
          domainCounts.set(article.domain, (domainCounts.get(article.domain) || 0) + 1);
          if (article.sourcecountry) {
            countryCounts.set(article.sourcecountry, (countryCounts.get(article.sourcecountry) || 0) + 1);
          }
        }

        const searchEntity = this.normalizer.createEntity({
          type: 'event',
          name: `GDELT: ${entity}`,
          description: `${articles.length} articles across ${domainCounts.size} sources in ${countryCounts.size} countries`,
          attributes: {
            totalArticles: articles.length,
            uniqueSources: domainCounts.size,
            uniqueCountries: countryCounts.size,
            topSources: Array.from(domainCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([domain, count]) => ({ domain, count })),
            sourceCountries: Array.from(countryCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([country, count]) => ({ country, count })),
            averageTone: toneResult?.summary?.tones?.avg,
          },
          sourceUrl: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(entity)}&mode=ArtList&format=html`,
          confidence: 0.85,
          tags: ['gdelt', 'media-monitoring', 'global-news'],
        });
        entities.push(searchEntity);

        for (const article of articles.slice(0, 30)) {
          const articleEntity = this.normalizer.createEntity({
            type: 'event',
            name: article.title || article.url,
            attributes: {
              url: article.url,
              domain: article.domain,
              seenDate: article.seendate,
              language: article.language,
              sourceCountry: article.sourcecountry,
              socialImage: article.socialimage,
            },
            sourceUrl: article.url,
            confidence: 0.75,
            tags: ['news-article', article.domain, article.language],
          });
          entities.push(articleEntity);

          relationships.push(
            this.normalizer.createRelationship({
              sourceEntityId: searchEntity.id,
              targetEntityId: articleEntity.id,
              type: 'references',
              label: 'mentioned in',
              confidence: 0.8,
            })
          );
        }
      } catch (err) {
        errors.push(this.buildError('GDELT_ERROR', `GDELT search failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: this.baseUrl,
        method: 'GET',
        params: { query: 'test', mode: 'ArtList', maxrecords: 1, format: 'json' },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'GDELT API unreachable' };
    }
  }
}
