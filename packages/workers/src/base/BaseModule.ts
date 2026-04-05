import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import Redis from 'ioredis';
import pino from 'pino';
import type {
  CollectionResult,
  NormalizedEntity,
  NormalizedRelationship,
  ModuleHealth,
  RateLimitConfig,
  ModuleCategory,
  CollectionMetadata,
  CollectionError,
} from './types.js';
import { RateLimiter } from './RateLimiter.js';
import { CacheManager } from './CacheManager.js';

export abstract class BaseModule {
  abstract name: string;
  abstract category: ModuleCategory;
  abstract supportedEntityTypes: string[];
  abstract rateLimit: RateLimitConfig;
  abstract cacheTTL: number;
  abstract requiresApiKey: boolean;

  protected redis: Redis;
  protected rateLimiter: RateLimiter;
  protected cache: CacheManager;
  protected logger: pino.Logger;
  protected httpClient: AxiosInstance;

  constructor(redis: Redis) {
    this.redis = redis;
    this.rateLimiter = new RateLimiter(redis);
    this.cache = new CacheManager(redis);
    this.logger = pino({ name: this.constructor.name });
    this.httpClient = axios.create({ timeout: 30000 });
  }

  abstract collect(entity: string, apiKey?: string): Promise<CollectionResult>;
  abstract normalize(rawData: unknown): NormalizedEntity[];
  abstract healthCheck(): Promise<ModuleHealth>;

  async executeWithCache(
    entity: string,
    entityType: string,
    apiKey: string | undefined,
    collectFn: () => Promise<{ rawData: unknown; entities: NormalizedEntity[]; relationships: NormalizedRelationship[]; metadata: Partial<CollectionMetadata>; errors: CollectionError[] }>
  ): Promise<CollectionResult> {
    const cacheKey = this.cache.buildKey(this.name, entity, entityType);
    const startTime = Date.now();

    const cached = await this.cache.get<CollectionResult>(cacheKey);
    if (cached) {
      this.logger.info({ entity, entityType }, 'Cache hit');
      cached.metadata.cached = true;
      return cached;
    }

    const result = await collectFn();
    const duration = Date.now() - startTime;

    const collectionResult: CollectionResult = {
      success: result.errors.length === 0 || result.entities.length > 0,
      module: this.name,
      entity,
      entityType,
      timestamp: new Date().toISOString(),
      rawData: result.rawData,
      normalized: result.entities,
      relationships: result.relationships,
      metadata: {
        duration,
        apiCalls: result.metadata.apiCalls ?? 1,
        cached: false,
        rateLimited: result.metadata.rateLimited ?? false,
        partial: result.metadata.partial ?? false,
        pagesFetched: result.metadata.pagesFetched ?? 1,
        totalPages: result.metadata.totalPages ?? 1,
      },
      errors: result.errors,
    };

    if (collectionResult.success) {
      await this.cache.set(cacheKey, collectionResult, this.cacheTTL);
    }

    return collectionResult;
  }

  async executeWithRateLimit<T>(fn: () => Promise<T>, tokens: number = 1): Promise<T> {
    const acquired = await this.rateLimiter.waitForToken(
      this.name,
      tokens,
      this.rateLimit,
      30000
    );

    if (!acquired) {
      throw new Error(`Rate limit exceeded for module ${this.name}`);
    }

    return fn();
  }

  async makeRequest<T>(
    config: AxiosRequestConfig,
    retries: number = 3,
    backoffMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.executeWithRateLimit(
          () => this.httpClient.request<T>(config)
        );
        return response.data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof AxiosError) {
          const status = err.response?.status;

          if (status && status >= 400 && status < 500 && status !== 429) {
            throw err;
          }

          if (status === 429) {
            const retryAfter = err.response?.headers?.['retry-after'];
            const waitMs = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : backoffMs * Math.pow(2, attempt);
            this.logger.warn({ attempt, waitMs, module: this.name }, 'Rate limited by API, backing off');
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
          }
        }

        if (attempt < retries) {
          const waitMs = backoffMs * Math.pow(2, attempt) + Math.random() * 500;
          this.logger.warn({ attempt, waitMs, error: lastError.message }, 'Request failed, retrying');
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  protected buildError(code: string, message: string, retryable: boolean = true): CollectionError {
    return {
      code,
      message,
      retryable,
      timestamp: new Date().toISOString(),
    };
  }
}
