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

interface HibpBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  ModifiedDate: string;
  PwnCount: number;
  Description: string;
  LogoPath: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
  IsMalware: boolean;
  IsSubscriptionFree: boolean;
}

interface HibpPaste {
  Source: string;
  Id: string;
  Title: string;
  Date: string;
  EmailCount: number;
}

export class HibpModule extends BaseModule {
  name = 'hibp';
  category = 'cti' as const;
  supportedEntityTypes = ['email', 'domain'];
  rateLimit: RateLimitConfig = { maxTokens: 1, refillRate: 1, refillInterval: 1500 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://haveibeenpwned.com/api/v3';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('hibp');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false,
        module: this.name,
        entity,
        entityType: 'email',
        timestamp: new Date().toISOString(),
        rawData: null,
        normalized: [],
        relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'HIBP API key (hibp-api-key) is required', false)],
      };
    }

    return this.executeWithCache(entity, 'email', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const isEmail = entity.includes('@');
      const headers = {
        'hibp-api-key': apiKey,
        'user-agent': 'OSINT-Dashboard',
      };

      if (isEmail) {
        // Breach lookup for email
        try {
          const breaches = await this.makeRequest<HibpBreach[]>({
            url: `${this.baseUrl}/breachedaccount/${encodeURIComponent(entity)}`,
            method: 'GET',
            params: { truncateResponse: 'false' },
            headers,
          });
          apiCalls++;
          rawData['breaches'] = breaches;

          const emailEntity = this.normalizer.createEntity({
            type: 'email',
            name: entity,
            description: `Found in ${breaches.length} breaches`,
            attributes: {
              totalBreaches: breaches.length,
              totalRecordsExposed: breaches.reduce((sum, b) => sum + b.PwnCount, 0),
              dataClassesExposed: [...new Set(breaches.flatMap((b) => b.DataClasses))],
            },
            sourceUrl: `https://haveibeenpwned.com/account/${encodeURIComponent(entity)}`,
            confidence: 0.95,
            tags: ['hibp', 'breached-email'],
          });
          entities.push(emailEntity);

          for (const breach of breaches) {
            const breachEntity = this.normalizer.createEntity({
              type: 'event',
              name: breach.Title,
              description: breach.Description.replace(/<[^>]*>/g, '').slice(0, 500),
              attributes: {
                breachName: breach.Name,
                domain: breach.Domain,
                breachDate: breach.BreachDate,
                addedDate: breach.AddedDate,
                pwnCount: breach.PwnCount,
                dataClasses: breach.DataClasses,
                isVerified: breach.IsVerified,
                isSensitive: breach.IsSensitive,
                isMalware: breach.IsMalware,
                logoPath: breach.LogoPath,
              },
              sourceUrl: `https://haveibeenpwned.com/PwnedWebsites#${breach.Name}`,
              confidence: 0.95,
              tags: ['data-breach', ...breach.DataClasses.slice(0, 5)],
            });
            entities.push(breachEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: emailEntity.id,
                targetEntityId: breachEntity.id,
                type: 'part_of',
                label: 'exposed in breach',
                confidence: 0.95,
              })
            );
          }
        } catch (err) {
          if (String(err).includes('404')) {
            rawData['breaches'] = [];
            entities.push(
              this.normalizer.createEntity({
                type: 'email',
                name: entity,
                description: 'No breaches found',
                attributes: { totalBreaches: 0 },
                confidence: 0.95,
                tags: ['hibp', 'no-breaches'],
              })
            );
          } else {
            errors.push(this.buildError('HIBP_BREACH_ERROR', `HIBP breach lookup failed: ${err}`));
          }
        }

        // Paste lookup
        try {
          const pastes = await this.makeRequest<HibpPaste[]>({
            url: `${this.baseUrl}/pasteaccount/${encodeURIComponent(entity)}`,
            method: 'GET',
            headers,
          });
          apiCalls++;
          rawData['pastes'] = pastes;

          for (const paste of (pastes || []).slice(0, 10)) {
            entities.push(
              this.normalizer.createEntity({
                type: 'event',
                name: paste.Title || `Paste from ${paste.Source}`,
                attributes: {
                  source: paste.Source,
                  pasteId: paste.Id,
                  date: paste.Date,
                  emailCount: paste.EmailCount,
                },
                confidence: 0.8,
                tags: ['paste', paste.Source.toLowerCase()],
              })
            );
          }
        } catch {
          // 404 = no pastes, which is fine
        }
      } else {
        // Domain breach search
        try {
          const breaches = await this.makeRequest<HibpBreach[]>({
            url: `${this.baseUrl}/breaches`,
            method: 'GET',
            params: { domain: entity },
            headers,
          });
          apiCalls++;
          rawData['domainBreaches'] = breaches;

          const domainEntity = this.normalizer.createEntity({
            type: 'domain',
            name: entity,
            description: `${breaches.length} breaches associated with domain`,
            attributes: { totalBreaches: breaches.length },
            confidence: 0.9,
            tags: ['hibp', 'breach-domain'],
          });
          entities.push(domainEntity);

          for (const breach of breaches) {
            const breachEntity = this.normalizer.createEntity({
              type: 'event',
              name: breach.Title,
              description: breach.Description.replace(/<[^>]*>/g, '').slice(0, 500),
              attributes: {
                breachName: breach.Name,
                breachDate: breach.BreachDate,
                pwnCount: breach.PwnCount,
                dataClasses: breach.DataClasses,
              },
              sourceUrl: `https://haveibeenpwned.com/PwnedWebsites#${breach.Name}`,
              confidence: 0.95,
              tags: ['data-breach'],
            });
            entities.push(breachEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: domainEntity.id,
                targetEntityId: breachEntity.id,
                type: 'references',
                label: 'breached',
                confidence: 0.95,
              })
            );
          }
        } catch (err) {
          errors.push(this.buildError('HIBP_DOMAIN_ERROR', `HIBP domain lookup failed: ${err}`));
        }
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    return [];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(`${this.baseUrl}/breaches`, { timeout: 5000, validateStatus: () => true });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'HIBP unreachable' };
    }
  }
}
