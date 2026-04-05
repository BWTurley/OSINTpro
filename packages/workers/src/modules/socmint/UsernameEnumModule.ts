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

interface WmnSite {
  name: string;
  uri_check: string;
  e_code: number;
  e_string: string;
  m_string: string;
  m_code: number;
  known: string[];
  cat: string;
  valid: boolean;
}

interface CheckResult {
  site: string;
  url: string;
  found: boolean;
  category: string;
  httpStatus: number;
}

export class UsernameEnumModule extends BaseModule {
  name = 'username-enum';
  category = 'socmint' as const;
  supportedEntityTypes = ['username'];
  rateLimit: RateLimitConfig = { maxTokens: 50, refillRate: 10, refillInterval: 1000 };
  cacheTTL = 7200;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private wmnUrl = 'https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('username-enum');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'username', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const username = entity.replace(/^@/, '').trim();

      try {
        // Fetch WhatsMyName data
        const cacheKey = 'wmn:sites-data';
        let sitesData = await this.cache.get<{ sites: WmnSite[] }>(cacheKey);

        if (!sitesData) {
          sitesData = await this.makeRequest<{ sites: WmnSite[] }>({
            url: this.wmnUrl,
            method: 'GET',
          });
          apiCalls++;
          await this.cache.set(cacheKey, sitesData, 86400);
        }

        const sites = sitesData.sites.filter((s) => s.valid !== false);
        rawData['totalSites'] = sites.length;

        // Check sites in batches for performance
        const batchSize = 20;
        const results: CheckResult[] = [];
        const found: CheckResult[] = [];

        for (let i = 0; i < sites.length; i += batchSize) {
          const batch = sites.slice(i, i + batchSize);
          const promises = batch.map(async (site): Promise<CheckResult | null> => {
            const url = site.uri_check.replace('{account}', username);
            try {
              const response = await this.httpClient.get(url, {
                timeout: 8000,
                maxRedirects: 3,
                validateStatus: () => true,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
              });

              const statusMatch = site.e_code ? response.status === site.e_code : true;
              const bodyStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
              const stringMatch = site.e_string ? bodyStr.includes(site.e_string) : true;
              const notMissing = site.m_string ? !bodyStr.includes(site.m_string) : true;
              const notMissingCode = site.m_code ? response.status !== site.m_code : true;

              const isFound = statusMatch && stringMatch && notMissing && notMissingCode;

              return {
                site: site.name,
                url,
                found: isFound,
                category: site.cat,
                httpStatus: response.status,
              };
            } catch {
              return null;
            }
          });

          const batchResults = await Promise.allSettled(promises);
          apiCalls += batch.length;

          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) {
              results.push(result.value);
              if (result.value.found) {
                found.push(result.value);
              }
            }
          }

          // Rate limit between batches
          if (i + batchSize < sites.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        rawData['totalChecked'] = results.length;
        rawData['totalFound'] = found.length;
        rawData['found'] = found;

        const mainEntity = this.normalizer.createEntity({
          type: 'username',
          name: username,
          description: `Found on ${found.length}/${results.length} platforms checked`,
          attributes: {
            totalChecked: results.length,
            totalFound: found.length,
            platforms: found.map((f) => ({
              site: f.site,
              url: f.url,
              category: f.category,
            })),
            categorySummary: this.categorize(found),
          },
          confidence: 0.85,
          tags: ['username-enumeration', 'whats-my-name'],
        });
        entities.push(mainEntity);

        for (const result of found) {
          entities.push(
            this.normalizer.createEntity({
              type: 'username',
              name: `${username} @ ${result.site}`,
              attributes: {
                platform: result.site,
                profileUrl: result.url,
                category: result.category,
              },
              sourceUrl: result.url,
              confidence: 0.7,
              tags: ['social-profile', result.category, result.site.toLowerCase()],
            })
          );
        }
      } catch (err) {
        errors.push(this.buildError('USERNAME_ENUM_ERROR', `Username enumeration failed: ${err}`));
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls, partial: true }, errors };
    });
  }

  private categorize(found: CheckResult[]): Record<string, number> {
    const categories: Record<string, number> = {};
    for (const f of found) {
      categories[f.category] = (categories[f.category] || 0) + 1;
    }
    return categories;
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.head(this.wmnUrl, { timeout: 5000 });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'WhatsMyName data unreachable' };
    }
  }
}
