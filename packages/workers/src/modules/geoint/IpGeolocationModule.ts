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

interface IpApiResponse {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
  mobile: boolean;
  proxy: boolean;
  hosting: boolean;
}

export class IpGeolocationModule extends BaseModule {
  name = 'ip-geolocation';
  category = 'geoint' as const;
  supportedEntityTypes = ['ip'];
  rateLimit: RateLimitConfig = { maxTokens: 45, refillRate: 45, refillInterval: 60000 };
  cacheTTL = 86400;
  requiresApiKey = false;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('ip-geolocation');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'ip', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      // Primary: ip-api.com (free, no auth, 45 req/min)
      try {
        const result = await this.makeRequest<IpApiResponse>({
          url: `http://ip-api.com/json/${entity}`,
          method: 'GET',
          params: { fields: 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query,mobile,proxy,hosting' },
        });
        apiCalls++;
        rawData['ipApi'] = result;

        if (result.status === 'success') {
          const ipEntity = this.normalizer.createEntity({
            type: 'ip',
            name: entity,
            description: `${result.city}, ${result.regionName}, ${result.country} | ${result.isp}`,
            attributes: {
              country: result.country,
              countryCode: result.countryCode,
              region: result.region,
              regionName: result.regionName,
              city: result.city,
              zip: result.zip,
              latitude: result.lat,
              longitude: result.lon,
              timezone: result.timezone,
              isp: result.isp,
              org: result.org,
              as: result.as,
              isMobile: result.mobile,
              isProxy: result.proxy,
              isHosting: result.hosting,
            },
            confidence: 0.85,
            tags: [
              'geolocation',
              result.countryCode.toLowerCase(),
              ...(result.proxy ? ['proxy'] : []),
              ...(result.hosting ? ['hosting'] : []),
              ...(result.mobile ? ['mobile'] : []),
            ],
          });
          entities.push(ipEntity);

          const locationEntity = this.normalizer.createEntity({
            type: 'location',
            name: `${result.city}, ${result.regionName}, ${result.country}`,
            attributes: {
              latitude: result.lat,
              longitude: result.lon,
              city: result.city,
              region: result.regionName,
              country: result.country,
              countryCode: result.countryCode,
              timezone: result.timezone,
            },
            confidence: 0.75,
            tags: ['ip-geolocation', result.countryCode.toLowerCase()],
          });
          entities.push(locationEntity);

          if (result.org) {
            const orgEntity = this.normalizer.createEntity({
              type: 'organization',
              name: result.org,
              attributes: { asn: result.as, isp: result.isp },
              confidence: 0.7,
              tags: ['isp', 'network-operator'],
            });
            entities.push(orgEntity);
          }
        }
      } catch (err) {
        errors.push(this.buildError('IP_API_ERROR', `ip-api.com lookup failed: ${err}`));

        // Fallback: ipinfo.io (limited free tier)
        try {
          const fallback = await this.makeRequest<{
            ip: string;
            hostname?: string;
            city: string;
            region: string;
            country: string;
            loc: string;
            org: string;
            postal: string;
            timezone: string;
          }>({
            url: `https://ipinfo.io/${entity}/json`,
            method: 'GET',
            ...(apiKey ? { params: { token: apiKey } } : {}),
          });
          apiCalls++;
          rawData['ipinfo'] = fallback;

          const [lat, lon] = (fallback.loc || '0,0').split(',').map(Number);

          entities.push(
            this.normalizer.createEntity({
              type: 'ip',
              name: entity,
              description: `${fallback.city}, ${fallback.region}, ${fallback.country} | ${fallback.org}`,
              attributes: {
                city: fallback.city,
                region: fallback.region,
                country: fallback.country,
                latitude: lat,
                longitude: lon,
                org: fallback.org,
                postal: fallback.postal,
                timezone: fallback.timezone,
                hostname: fallback.hostname,
              },
              confidence: 0.8,
              tags: ['geolocation', 'ipinfo'],
            })
          );
        } catch (err2) {
          errors.push(this.buildError('IPINFO_ERROR', `ipinfo.io fallback failed: ${err2}`));
        }
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
      await this.makeRequest({
        url: 'http://ip-api.com/json/8.8.8.8',
        method: 'GET',
        params: { fields: 'status' },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'IP geolocation APIs unreachable' };
    }
  }
}
