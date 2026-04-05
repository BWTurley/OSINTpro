import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SearchService } from '../services/searchService.js';
import { GraphService } from '../services/graphService.js';
import { StorageService } from '../services/storageService.js';
import IORedis from 'ioredis';
import { config } from '../config.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  services: Record<string, { status: 'up' | 'down'; latencyMs?: number }>;
}

export function createHealthRouter(
  prisma: PrismaClient,
  searchService: SearchService,
  graphService: GraphService,
  storageService: StorageService,
): Router {
  const router = Router();
  const startTime = Date.now();

  // GET /health -- quick liveness check
  router.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /health/ready -- full readiness check across all services
  router.get('/ready', async (_req: Request, res: Response) => {
    const services: Record<string, { status: 'up' | 'down'; latencyMs?: number }> = {};

    // PostgreSQL
    const pgStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      services.postgres = { status: 'up', latencyMs: Date.now() - pgStart };
    } catch {
      services.postgres = { status: 'down', latencyMs: Date.now() - pgStart };
    }

    // Elasticsearch
    const esStart = Date.now();
    try {
      const healthy = await searchService.healthCheck();
      services.elasticsearch = {
        status: healthy ? 'up' : 'down',
        latencyMs: Date.now() - esStart,
      };
    } catch {
      services.elasticsearch = { status: 'down', latencyMs: Date.now() - esStart };
    }

    // Neo4j
    const neoStart = Date.now();
    try {
      const healthy = await graphService.verifyConnectivity();
      services.neo4j = {
        status: healthy ? 'up' : 'down',
        latencyMs: Date.now() - neoStart,
      };
    } catch {
      services.neo4j = { status: 'down', latencyMs: Date.now() - neoStart };
    }

    // Redis
    const redisStart = Date.now();
    try {
      const redis = new IORedis(config.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      services.redis = { status: 'up', latencyMs: Date.now() - redisStart };
      await redis.quit();
    } catch {
      services.redis = { status: 'down', latencyMs: Date.now() - redisStart };
    }

    // MinIO
    const minioStart = Date.now();
    try {
      const healthy = await storageService.healthCheck();
      services.minio = {
        status: healthy ? 'up' : 'down',
        latencyMs: Date.now() - minioStart,
      };
    } catch {
      services.minio = { status: 'down', latencyMs: Date.now() - minioStart };
    }

    const allUp = Object.values(services).every((s) => s.status === 'up');
    const anyUp = Object.values(services).some((s) => s.status === 'up');

    const overallStatus: HealthStatus['status'] = allUp
      ? 'healthy'
      : anyUp
        ? 'degraded'
        : 'unhealthy';

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

    const result: HealthStatus = {
      status: overallStatus,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      services,
    };

    res.status(statusCode).json(result);
  });

  return router;
}
