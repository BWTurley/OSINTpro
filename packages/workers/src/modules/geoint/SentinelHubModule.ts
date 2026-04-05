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

interface SentinelToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CatalogSearchResult {
  type: string;
  features: Array<{
    type: string;
    id: string;
    geometry: {
      type: string;
      coordinates: number[][][];
    };
    properties: {
      datetime: string;
      'eo:cloud_cover'?: number;
      's2:product_uri'?: string;
      's2:granule_id'?: string;
      created: string;
      updated: string;
    };
  }>;
  context: {
    returned: number;
    limit: number;
  };
}

export class SentinelHubModule extends BaseModule {
  name = 'sentinel-hub';
  category = 'geoint' as const;
  supportedEntityTypes = ['location'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 1, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('sentinel-hub');
  }

  private async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const cacheKey = 'sentinel-hub:oauth-token';
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const tokenResult = await this.makeRequest<SentinelToken>({
      url: 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
      method: 'POST',
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    await this.cache.set(cacheKey, tokenResult.access_token, tokenResult.expires_in - 60);
    return tokenResult.access_token;
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false,
        module: this.name,
        entity,
        entityType: 'location',
        timestamp: new Date().toISOString(),
        rawData: null,
        normalized: [],
        relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'Sentinel Hub requires client_id:client_secret format API key', false)],
      };
    }

    return this.executeWithCache(entity, 'location', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const coordMatch = entity.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (!coordMatch) {
        errors.push(this.buildError('INVALID_COORDS', 'Entity must be lat,lon coordinates', false));
        return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
      }

      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);

      const [clientId, clientSecret] = apiKey.split(':');
      if (!clientId || !clientSecret) {
        errors.push(this.buildError('INVALID_KEY_FORMAT', 'API key must be in client_id:client_secret format', false));
        return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
      }

      try {
        const token = await this.getAccessToken(clientId, clientSecret);
        apiCalls++;

        // Create a small bounding box around the point (~10km)
        const delta = 0.05;
        const bbox = [lon - delta, lat - delta, lon + delta, lat + delta];

        const now = new Date();
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        const searchResult = await this.makeRequest<CatalogSearchResult>({
          url: 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          data: {
            collections: ['sentinel-2-l2a'],
            datetime: `${threeMonthsAgo.toISOString()}/${now.toISOString()}`,
            bbox,
            limit: 10,
            filter: 'eo:cloud_cover < 20',
            'filter-lang': 'cql2-text',
          },
        });
        apiCalls++;
        rawData['catalog'] = searchResult;

        const locationEntity = this.normalizer.createEntity({
          type: 'location',
          name: `${lat}, ${lon}`,
          description: `Sentinel-2 imagery: ${searchResult.context.returned} scenes found`,
          attributes: {
            latitude: lat,
            longitude: lon,
            sceneCount: searchResult.context.returned,
            scenes: searchResult.features.map((f) => ({
              id: f.id,
              datetime: f.properties.datetime,
              cloudCover: f.properties['eo:cloud_cover'],
              productUri: f.properties['s2:product_uri'],
              geometry: f.geometry,
            })),
          },
          confidence: 0.95,
          tags: ['sentinel-2', 'satellite-imagery', 'geoint'],
        });
        entities.push(locationEntity);

      } catch (err) {
        errors.push(this.buildError('SENTINEL_ERROR', `Sentinel Hub query failed: ${err}`));
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    return [];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get('https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/', {
        timeout: 5000,
        validateStatus: () => true,
      });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Sentinel Hub unreachable' };
    }
  }
}
