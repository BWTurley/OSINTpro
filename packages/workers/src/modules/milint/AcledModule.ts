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

interface AcledEvent {
  data_id: number;
  iso: number;
  event_id_cnty: string;
  event_id_no_cnty: number;
  event_date: string;
  year: number;
  time_precision: number;
  disorder_type: string;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  assoc_actor_1: string;
  inter1: number;
  actor2: string;
  assoc_actor_2: string;
  inter2: number;
  interaction: number;
  region: string;
  country: string;
  admin1: string;
  admin2: string;
  admin3: string;
  location: string;
  latitude: number;
  longitude: number;
  geo_precision: number;
  source: string;
  source_scale: string;
  notes: string;
  fatalities: number;
  tags: string;
  timestamp: number;
}

export class AcledModule extends BaseModule {
  name = 'acled';
  category = 'milint' as const;
  supportedEntityTypes = ['country', 'location', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 10, refillRate: 2, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.acleddata.com/acled/read';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('acled');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false, module: this.name, entity, entityType: 'country',
        timestamp: new Date().toISOString(), rawData: null, normalized: [], relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'ACLED API key required (format: key:email)', false)],
      };
    }

    return this.executeWithCache(entity, 'country', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const [key, email] = apiKey.split(':');
      if (!key || !email) {
        errors.push(this.buildError('INVALID_KEY', 'ACLED API key must be in key:email format', false));
        return { rawData, entities, relationships, metadata: { apiCalls }, errors };
      }

      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      try {
        const params: Record<string, string | number> = {
          key,
          email,
          limit: 100,
          event_date: `${threeMonthsAgo}|`,
          event_date_where: 'BETWEEN',
        };

        // Detect if entity is a country name or actor
        const isCountry = entity.length <= 3 || /^[A-Z]{2,3}$/.test(entity);
        if (isCountry) {
          params['iso'] = entity.length <= 3 ? entity : '';
          params['country'] = entity;
        } else {
          params['actor1'] = entity;
        }

        const result = await this.makeRequest<{
          success: boolean;
          data: AcledEvent[];
          count: number;
        }>({
          url: this.baseUrl,
          method: 'GET',
          params,
        });
        apiCalls++;
        rawData['events'] = result;

        const events = result.data || [];
        let totalFatalities = 0;
        const eventTypeCounts = new Map<string, number>();
        const actorCounts = new Map<string, number>();

        for (const event of events) {
          totalFatalities += event.fatalities || 0;
          eventTypeCounts.set(event.event_type, (eventTypeCounts.get(event.event_type) || 0) + 1);
          if (event.actor1) actorCounts.set(event.actor1, (actorCounts.get(event.actor1) || 0) + 1);
          if (event.actor2) actorCounts.set(event.actor2, (actorCounts.get(event.actor2) || 0) + 1);

          const eventEntity = this.normalizer.createEntity({
            type: 'event',
            name: `${event.event_type}: ${event.location}, ${event.country} (${event.event_date})`,
            description: event.notes?.slice(0, 500) || '',
            attributes: {
              acledId: event.data_id,
              eventDate: event.event_date,
              disorderType: event.disorder_type,
              eventType: event.event_type,
              subEventType: event.sub_event_type,
              actor1: event.actor1,
              assocActor1: event.assoc_actor_1,
              actor2: event.actor2,
              assocActor2: event.assoc_actor_2,
              interaction: event.interaction,
              country: event.country,
              region: event.region,
              admin1: event.admin1,
              admin2: event.admin2,
              location: event.location,
              latitude: event.latitude,
              longitude: event.longitude,
              geoPrecision: event.geo_precision,
              source: event.source,
              fatalities: event.fatalities,
            },
            sourceUrl: 'https://acleddata.com/',
            confidence: 0.9,
            tags: ['acled', 'conflict', event.event_type.toLowerCase(), event.country.toLowerCase()],
          });
          entities.push(eventEntity);

          // Create actor entities
          if (event.actor1) {
            const actor1Entity = this.normalizer.createEntity({
              type: 'organization',
              name: event.actor1,
              attributes: { actorType: event.inter1 },
              confidence: 0.8,
              tags: ['conflict-actor'],
            });
            entities.push(actor1Entity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: actor1Entity.id,
                targetEntityId: eventEntity.id,
                type: 'part_of',
                label: 'participant',
                confidence: 0.9,
              })
            );
          }
        }

        // Summary entity
        if (events.length > 0) {
          entities.unshift(
            this.normalizer.createEntity({
              type: 'event',
              name: `ACLED Summary: ${entity}`,
              description: `${events.length} events, ${totalFatalities} fatalities in last 90 days`,
              attributes: {
                totalEvents: events.length,
                totalFatalities,
                eventTypeBreakdown: Object.fromEntries(eventTypeCounts),
                topActors: Array.from(actorCounts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([actor, count]) => ({ actor, count })),
              },
              confidence: 0.9,
              tags: ['acled', 'conflict-summary'],
            })
          );
        }
      } catch (err) {
        errors.push(this.buildError('ACLED_ERROR', `ACLED query failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(this.baseUrl, { timeout: 5000, params: { limit: 0 }, validateStatus: () => true });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'ACLED API unreachable' };
    }
  }
}
