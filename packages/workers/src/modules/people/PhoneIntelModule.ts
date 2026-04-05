import Redis from 'ioredis';
import { BaseModule } from '../../base/BaseModule.js';
import { Normalizer } from '../../base/Normalizer.js';
import type {
  CollectionResult,
  NormalizedEntity,
  ModuleHealth,
  RateLimitConfig,
  CollectionError,
} from '../../base/types.js';

interface NumVerifyResult {
  valid: boolean;
  number: string;
  local_format: string;
  international_format: string;
  country_prefix: string;
  country_code: string;
  country_name: string;
  location: string;
  carrier: string;
  line_type: string;
}

interface AbstractPhoneResult {
  phone: string;
  valid: boolean;
  format: { international: string; local: string };
  country: { code: string; name: string; prefix: string };
  location: string;
  type: string;
  carrier: string;
}

export class PhoneIntelModule extends BaseModule {
  name = 'phone-intel';
  category = 'people' as const;
  supportedEntityTypes = ['phone'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 1, refillInterval: 1000 };
  cacheTTL = 86400;
  requiresApiKey = true;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('phone-intel');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false, module: this.name, entity, entityType: 'phone',
        timestamp: new Date().toISOString(), rawData: null, normalized: [], relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'NumVerify or Abstract API key required (format: numverify_key or abstract:key)', false)],
      };
    }

    return this.executeWithCache(entity, 'phone', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const phone = entity.replace(/[\s\-\(\)\.]/g, '');

      // Try NumVerify first
      const isAbstract = apiKey.startsWith('abstract:');
      const actualKey = isAbstract ? apiKey.replace('abstract:', '') : apiKey;

      if (!isAbstract) {
        try {
          const result = await this.makeRequest<NumVerifyResult>({
            url: 'http://apilayer.net/api/validate',
            method: 'GET',
            params: { access_key: actualKey, number: phone, format: 1 },
          });
          apiCalls++;
          rawData['numverify'] = result;

          if (result.valid) {
            entities.push(
              this.normalizer.createEntity({
                type: 'phone',
                name: result.international_format || phone,
                description: `${result.carrier || 'Unknown carrier'} | ${result.line_type} | ${result.country_name}`,
                attributes: {
                  valid: result.valid,
                  localFormat: result.local_format,
                  internationalFormat: result.international_format,
                  countryPrefix: result.country_prefix,
                  countryCode: result.country_code,
                  countryName: result.country_name,
                  location: result.location,
                  carrier: result.carrier,
                  lineType: result.line_type,
                },
                confidence: 0.9,
                tags: ['phone', 'numverify', result.line_type, result.country_code],
              })
            );

            if (result.location) {
              entities.push(
                this.normalizer.createEntity({
                  type: 'location',
                  name: `${result.location}, ${result.country_name}`,
                  attributes: {
                    countryCode: result.country_code,
                    countryName: result.country_name,
                    city: result.location,
                  },
                  confidence: 0.6,
                  tags: ['phone-location'],
                })
              );
            }
          } else {
            entities.push(
              this.normalizer.createEntity({
                type: 'phone',
                name: phone,
                description: 'Invalid phone number',
                attributes: { valid: false },
                confidence: 0.5,
                tags: ['phone', 'invalid'],
              })
            );
          }
        } catch (err) {
          errors.push(this.buildError('NUMVERIFY_ERROR', `NumVerify lookup failed: ${err}`));
        }
      } else {
        // Abstract API
        try {
          const result = await this.makeRequest<AbstractPhoneResult>({
            url: 'https://phonevalidation.abstractapi.com/v1/',
            method: 'GET',
            params: { api_key: actualKey, phone },
          });
          apiCalls++;
          rawData['abstract'] = result;

          entities.push(
            this.normalizer.createEntity({
              type: 'phone',
              name: result.format?.international || phone,
              description: `${result.carrier || 'Unknown carrier'} | ${result.type} | ${result.country?.name}`,
              attributes: {
                valid: result.valid,
                internationalFormat: result.format?.international,
                localFormat: result.format?.local,
                countryCode: result.country?.code,
                countryName: result.country?.name,
                countryPrefix: result.country?.prefix,
                location: result.location,
                carrier: result.carrier,
                lineType: result.type,
              },
              confidence: result.valid ? 0.9 : 0.5,
              tags: ['phone', 'abstract-api', result.type, result.country?.code].filter(Boolean) as string[],
            })
          );
        } catch (err) {
          errors.push(this.buildError('ABSTRACT_ERROR', `Abstract API lookup failed: ${err}`));
        }
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Requires API key for validation' };
  }
}
