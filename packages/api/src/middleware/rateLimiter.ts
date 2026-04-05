import { Request, Response, NextFunction } from 'express';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
    redis.on('error', (err) => {
      logger.error({ err }, 'Rate limiter Redis connection error');
    });
  }
  return redis;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export function createRateLimiter(options?: Partial<RateLimitOptions>) {
  const windowMs = options?.windowMs ?? config.RATE_LIMIT_WINDOW_MS;
  const maxRequests = options?.maxRequests ?? config.RATE_LIMIT_MAX_REQUESTS;
  const keyPrefix = options?.keyPrefix ?? 'rl';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const client = getRedis();

      // Sliding window using a sorted set
      const pipeline = client.pipeline();
      // Remove entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);
      // Add current request
      pipeline.zadd(key, now, `${now}:${Math.random()}`);
      // Count requests in window
      pipeline.zcard(key);
      // Set TTL on the key
      pipeline.pexpire(key, windowMs);

      const results = await pipeline.exec();
      if (!results) {
        return next();
      }

      const count = results[2]?.[1] as number;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

      if (count > maxRequests) {
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000),
        });
        return;
      }

      next();
    } catch (err) {
      // If Redis is down, allow the request through (fail open)
      logger.warn({ err }, 'Rate limiter Redis error, allowing request');
      next();
    }
  };
}

export async function closeRateLimiter(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
