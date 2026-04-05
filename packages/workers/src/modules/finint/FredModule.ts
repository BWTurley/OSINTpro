import { Redis } from 'ioredis';
import { BaseModule } from '../../base/BaseModule.js';
import { Normalizer } from '../../base/Normalizer.js';
import type {
  CollectionResult,
  NormalizedEntity,
  ModuleHealth,
  RateLimitConfig,
  CollectionError,
} from '../../base/types.js';

interface FredSeries {
  id: string;
  realtime_start: string;
  realtime_end: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  frequency_short: string;
  units: string;
  units_short: string;
  seasonal_adjustment: string;
  seasonal_adjustment_short: string;
  last_updated: string;
  popularity: number;
  notes: string;
}

interface FredObservation {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string;
}

export class FredModule extends BaseModule {
  name = 'fred';
  category = 'finint' as const;
  supportedEntityTypes = ['organization', 'country'];
  rateLimit: RateLimitConfig = { maxTokens: 120, refillRate: 120, refillInterval: 60000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.stlouisfed.org/fred';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('fred');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false,
        module: this.name,
        entity,
        entityType: 'organization',
        timestamp: new Date().toISOString(),
        rawData: null,
        normalized: [],
        relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'FRED API key is required', false)],
      };
    }

    return this.executeWithCache(entity, 'organization', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        const searchResult = await this.makeRequest<{
          seriess: FredSeries[];
          count: number;
        }>({
          url: `${this.baseUrl}/series/search`,
          method: 'GET',
          params: {
            api_key: apiKey,
            search_text: entity,
            file_type: 'json',
            limit: 10,
            order_by: 'popularity',
            sort_order: 'desc',
          },
        });
        apiCalls++;
        rawData['search'] = searchResult;

        for (const series of searchResult.seriess) {
          try {
            const observations = await this.makeRequest<{
              observations: FredObservation[];
            }>({
              url: `${this.baseUrl}/series/observations`,
              method: 'GET',
              params: {
                api_key: apiKey,
                series_id: series.id,
                file_type: 'json',
                limit: 60,
                sort_order: 'desc',
              },
            });
            apiCalls++;

            const recentObs = observations.observations
              .filter((o) => o.value !== '.')
              .slice(0, 12);

            const latestValue = recentObs[0]?.value;
            const previousValue = recentObs[1]?.value;
            const changePercent =
              latestValue && previousValue
                ? ((parseFloat(latestValue) - parseFloat(previousValue)) / Math.abs(parseFloat(previousValue))) * 100
                : null;

            entities.push(
              this.normalizer.createEntity({
                type: 'indicator',
                name: series.title,
                description: series.notes || `${series.title} (${series.units})`,
                attributes: {
                  seriesId: series.id,
                  frequency: series.frequency,
                  units: series.units,
                  seasonalAdjustment: series.seasonal_adjustment,
                  lastUpdated: series.last_updated,
                  popularity: series.popularity,
                  latestValue: latestValue ? parseFloat(latestValue) : null,
                  latestDate: recentObs[0]?.date,
                  changePercent: changePercent ? Math.round(changePercent * 100) / 100 : null,
                  recentObservations: recentObs.map((o) => ({
                    date: o.date,
                    value: parseFloat(o.value),
                  })),
                },
                sourceUrl: `https://fred.stlouisfed.org/series/${series.id}`,
                confidence: 0.95,
                tags: ['economic-data', 'fred', series.frequency_short],
              })
            );
          } catch (err) {
            errors.push(this.buildError('OBS_ERROR', `Failed to fetch observations for ${series.id}: ${err}`));
          }
        }
      } catch (err) {
        errors.push(this.buildError('SEARCH_ERROR', `FRED search failed: ${err}`));
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const search = data['search'] as { seriess: FredSeries[] } | undefined;
    if (!search) return [];

    return search.seriess.map((s) =>
      this.normalizer.createEntity({
        type: 'indicator',
        name: s.title,
        attributes: { seriesId: s.id, units: s.units, frequency: s.frequency },
        sourceUrl: `https://fred.stlouisfed.org/series/${s.id}`,
        tags: ['fred'],
      })
    );
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      // Can't fully test without API key but can check if endpoint responds
      await this.httpClient.get(`${this.baseUrl}/series`, {
        params: { series_id: 'GDP', file_type: 'json' },
        timeout: 5000,
        validateStatus: () => true,
      });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'FRED API unreachable' };
    }
  }
}
