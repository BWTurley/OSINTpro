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

interface HunterResult {
  data: {
    email: string;
    score: number;
    status: string;
    result: string;
    sources: Array<{ domain: string; uri: string; extracted_on: string; last_seen_on: string }>;
    first_name: string;
    last_name: string;
    position: string;
    company: string;
    twitter: string;
    linkedin_url: string;
    phone_number: string;
  };
}

interface HunterDomainSearch {
  data: {
    domain: string;
    disposable: boolean;
    webmail: boolean;
    accept_all: boolean;
    pattern: string;
    organization: string;
    emails: Array<{
      value: string;
      type: string;
      confidence: number;
      first_name: string;
      last_name: string;
      position: string;
      department: string;
      sources: Array<{ domain: string; uri: string }>;
    }>;
  };
  meta: { results: number; limit: number; offset: number };
}

export class EmailIntelModule extends BaseModule {
  name = 'email-intel';
  category = 'people' as const;
  supportedEntityTypes = ['email', 'domain', 'person'];
  rateLimit: RateLimitConfig = { maxTokens: 10, refillRate: 10, refillInterval: 60000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('email-intel');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false, module: this.name, entity, entityType: 'email',
        timestamp: new Date().toISOString(), rawData: null, normalized: [], relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'Hunter.io API key required', false)],
      };
    }

    return this.executeWithCache(entity, 'email', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const isEmail = entity.includes('@');
      const isDomain = !isEmail && entity.includes('.');

      if (isEmail) {
        // Email verification + enrichment
        try {
          const verifyResult = await this.makeRequest<HunterResult>({
            url: 'https://api.hunter.io/v2/email-verifier',
            method: 'GET',
            params: { email: entity, api_key: apiKey },
          });
          apiCalls++;
          rawData['verification'] = verifyResult;

          const d = verifyResult.data;

          const emailEntity = this.normalizer.createEntity({
            type: 'email',
            name: entity,
            description: `Hunter.io: ${d.result} (score: ${d.score})`,
            attributes: {
              score: d.score,
              status: d.status,
              result: d.result,
              firstName: d.first_name,
              lastName: d.last_name,
              position: d.position,
              company: d.company,
              twitter: d.twitter,
              linkedinUrl: d.linkedin_url,
              phoneNumber: d.phone_number,
              sources: d.sources,
            },
            sourceUrl: `https://hunter.io/verify/${entity}`,
            confidence: d.score / 100,
            tags: ['email', 'hunter-io', d.result],
          });
          entities.push(emailEntity);

          if (d.first_name && d.last_name) {
            const personEntity = this.normalizer.createEntity({
              type: 'person',
              name: `${d.first_name} ${d.last_name}`,
              attributes: {
                firstName: d.first_name,
                lastName: d.last_name,
                position: d.position,
                company: d.company,
                twitter: d.twitter,
                linkedin: d.linkedin_url,
                phone: d.phone_number,
              },
              confidence: 0.8,
              tags: ['email-enrichment'],
            });
            entities.push(personEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: personEntity.id,
                targetEntityId: emailEntity.id,
                type: 'owns',
                label: 'uses email',
                confidence: 0.85,
              })
            );
          }

          if (d.company) {
            const orgEntity = this.normalizer.createEntity({
              type: 'organization',
              name: d.company,
              attributes: {},
              confidence: 0.7,
              tags: ['employer'],
            });
            entities.push(orgEntity);
          }
        } catch (err) {
          errors.push(this.buildError('HUNTER_VERIFY_ERROR', `Hunter.io verification failed: ${err}`));
        }

        // Check email format/patterns via holehe-style checks (basic)
        try {
          const domain = entity.split('@')[1];
          const services: Array<{ name: string; url: string; method: string; bodyKey: string }> = [
            { name: 'Gravatar', url: 'https://en.gravatar.com/', method: 'GET', bodyKey: '' },
          ];

          // Gravatar check
          const crypto = await import('node:crypto');
          const emailHash = crypto.createHash('md5').update(entity.trim().toLowerCase()).digest('hex');
          try {
            await this.httpClient.get(`https://en.gravatar.com/${emailHash}.json`, { timeout: 5000, validateStatus: (s) => s === 200 });
            entities.push(
              this.normalizer.createEntity({
                type: 'username',
                name: `${entity} on Gravatar`,
                attributes: { platform: 'Gravatar', profileUrl: `https://en.gravatar.com/${emailHash}`, avatarUrl: `https://www.gravatar.com/avatar/${emailHash}` },
                sourceUrl: `https://en.gravatar.com/${emailHash}`,
                confidence: 0.85,
                tags: ['gravatar', 'email-linked'],
              })
            );
            apiCalls++;
          } catch {
            // No gravatar
            apiCalls++;
          }
        } catch {
          // Supplementary
        }
      } else if (isDomain) {
        // Domain email search
        try {
          const domainResult = await this.makeRequest<HunterDomainSearch>({
            url: 'https://api.hunter.io/v2/domain-search',
            method: 'GET',
            params: { domain: entity, api_key: apiKey, limit: 20 },
          });
          apiCalls++;
          rawData['domainSearch'] = domainResult;

          const d = domainResult.data;

          const domainEntity = this.normalizer.createEntity({
            type: 'domain',
            name: entity,
            description: `${d.organization || entity}: ${domainResult.meta.results} emails found, pattern: ${d.pattern}`,
            attributes: {
              organization: d.organization,
              disposable: d.disposable,
              webmail: d.webmail,
              acceptAll: d.accept_all,
              emailPattern: d.pattern,
              totalEmails: domainResult.meta.results,
            },
            confidence: 0.9,
            tags: ['domain-search', 'hunter-io'],
          });
          entities.push(domainEntity);

          for (const email of d.emails) {
            const emailEntity = this.normalizer.createEntity({
              type: 'email',
              name: email.value,
              attributes: {
                type: email.type,
                confidence: email.confidence,
                firstName: email.first_name,
                lastName: email.last_name,
                position: email.position,
                department: email.department,
                sources: email.sources,
              },
              confidence: email.confidence / 100,
              tags: ['hunter-io', email.type],
            });
            entities.push(emailEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: domainEntity.id,
                targetEntityId: emailEntity.id,
                type: 'owns',
                label: 'domain email',
                confidence: 0.85,
              })
            );

            if (email.first_name && email.last_name) {
              const personEntity = this.normalizer.createEntity({
                type: 'person',
                name: `${email.first_name} ${email.last_name}`,
                attributes: { position: email.position, department: email.department },
                confidence: 0.75,
                tags: ['employee'],
              });
              entities.push(personEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: personEntity.id,
                  targetEntityId: emailEntity.id,
                  type: 'owns',
                  label: 'uses email',
                  confidence: 0.8,
                })
              );
            }
          }
        } catch (err) {
          errors.push(this.buildError('HUNTER_DOMAIN_ERROR', `Hunter.io domain search failed: ${err}`));
        }
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get('https://api.hunter.io/v2/account', { timeout: 5000, validateStatus: () => true });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Hunter.io unreachable' };
    }
  }
}
