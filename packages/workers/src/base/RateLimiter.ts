import { Redis } from 'ioredis';
import pino from 'pino';
import type { RateLimitConfig } from './types.js';

const logger = pino({ name: 'rate-limiter' });

export class RateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async tryAcquire(moduleKey: string, tokens: number, config: RateLimitConfig): Promise<boolean> {
    const key = `ratelimit:${moduleKey}`;
    const now = Date.now();

    const luaScript = `
      local key = KEYS[1]
      local maxTokens = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local refillInterval = tonumber(ARGV[3])
      local requested = tonumber(ARGV[4])
      local now = tonumber(ARGV[5])

      local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local currentTokens = tonumber(bucket[1])
      local lastRefill = tonumber(bucket[2])

      if currentTokens == nil then
        currentTokens = maxTokens
        lastRefill = now
      end

      local elapsed = now - lastRefill
      local intervalsElapsed = math.floor(elapsed / refillInterval)
      if intervalsElapsed > 0 then
        currentTokens = math.min(maxTokens, currentTokens + (intervalsElapsed * refillRate))
        lastRefill = lastRefill + (intervalsElapsed * refillInterval)
      end

      if currentTokens >= requested then
        currentTokens = currentTokens - requested
        redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, 3600)
        return 1
      else
        redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, 3600)
        return 0
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      key,
      config.maxTokens,
      config.refillRate,
      config.refillInterval,
      tokens,
      now
    );

    return result === 1;
  }

  async getRemaining(moduleKey: string, config: RateLimitConfig): Promise<number> {
    const key = `ratelimit:${moduleKey}`;
    const now = Date.now();

    const bucket = await this.redis.hmget(key, 'tokens', 'lastRefill');
    let currentTokens = bucket[0] ? parseFloat(bucket[0]) : config.maxTokens;
    const lastRefill = bucket[1] ? parseFloat(bucket[1]) : now;

    const elapsed = now - lastRefill;
    const intervalsElapsed = Math.floor(elapsed / config.refillInterval);
    if (intervalsElapsed > 0) {
      currentTokens = Math.min(config.maxTokens, currentTokens + intervalsElapsed * config.refillRate);
    }

    return currentTokens;
  }

  async waitForToken(
    moduleKey: string,
    tokens: number,
    config: RateLimitConfig,
    maxWaitMs: number = 30000
  ): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      const acquired = await this.tryAcquire(moduleKey, tokens, config);
      if (acquired) return true;

      attempt++;
      const backoff = Math.min(config.refillInterval, 1000 * Math.pow(1.5, attempt));
      const jitter = Math.random() * backoff * 0.3;
      const waitTime = Math.min(backoff + jitter, deadline - Date.now());

      if (waitTime <= 0) break;

      logger.debug({ moduleKey, attempt, waitTime }, 'Rate limited, waiting');
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    logger.warn({ moduleKey, tokens, maxWaitMs }, 'Rate limit wait timeout');
    return false;
  }

  async reset(moduleKey: string): Promise<void> {
    await this.redis.del(`ratelimit:${moduleKey}`);
  }
}
