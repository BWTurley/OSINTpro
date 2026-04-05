import Redis from 'ioredis';
import pino from 'pino';
import type { CacheStats } from './types.js';

const logger = pino({ name: 'cache-manager' });

const CACHE_PREFIX = 'osint:cache:';
const STATS_PREFIX = 'osint:cache-stats:';

export class CacheManager {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = `${CACHE_PREFIX}${key}`;
    try {
      const raw = await this.redis.get(fullKey);
      if (!raw) {
        await this.redis.hincrby(`${STATS_PREFIX}global`, 'misses', 1);
        return null;
      }
      await this.redis.hincrby(`${STATS_PREFIX}global`, 'hits', 1);
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.error({ key, err }, 'Cache get error');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const fullKey = `${CACHE_PREFIX}${key}`;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.redis.setex(fullKey, ttlSeconds, serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }
    } catch (err) {
      logger.error({ key, err }, 'Cache set error');
    }
  }

  async invalidate(pattern: string): Promise<number> {
    const fullPattern = `${CACHE_PREFIX}${pattern}`;
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        fullPattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');

    logger.info({ pattern, deleted }, 'Cache invalidated');
    return deleted;
  }

  async getCacheStats(): Promise<CacheStats> {
    const stats = await this.redis.hgetall(`${STATS_PREFIX}global`);
    let keyCount = 0;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${CACHE_PREFIX}*`,
        'COUNT',
        1000
      );
      cursor = nextCursor;
      keyCount += keys.length;
    } while (cursor !== '0');

    return {
      hits: parseInt(stats['hits'] || '0', 10),
      misses: parseInt(stats['misses'] || '0', 10),
      size: 0,
      keys: keyCount,
    };
  }

  buildKey(module: string, entity: string, entityType: string, extra?: string): string {
    const parts = [module, entityType, entity];
    if (extra) parts.push(extra);
    return parts.join(':');
  }
}
