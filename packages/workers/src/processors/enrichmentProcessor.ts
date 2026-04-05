import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import type { EnrichmentJob, CollectionJob } from '../base/types.js';
import type { BaseModule } from '../base/BaseModule.js';
import { collectionQueue } from '../queues/collectionQueue.js';

const logger = pino({ name: 'enrichment-processor' });

const ENTITY_TYPE_MODULE_MAP: Record<string, string[]> = {
  ip: ['ip-geolocation', 'shodan', 'abuseipdb', 'virustotal'],
  domain: ['rdap', 'dns', 'security-trails', 'cert-transparency', 'urlscan'],
  email: ['email-intel', 'hibp'],
  hash: ['virustotal', 'abuse-ch'],
  username: ['reddit', 'bluesky', 'mastodon', 'username-enum', 'youtube'],
  person: ['academic', 'court-records', 'congress', 'fec'],
  organization: ['sec-edgar', 'open-corporates', 'gleif', 'sanctions', 'federal-spending', 'federal-register', 'gdelt'],
  phone: ['phone-intel'],
  url: ['urlscan', 'virustotal'],
  wallet: ['crypto'],
  location: ['osm', 'acled'],
  vulnerability: ['nvd', 'cisa-kev'],
};

export function createEnrichmentWorker(
  connection: Redis,
  moduleRegistry: Map<string, BaseModule>,
  concurrency: number = 3,
): Worker<EnrichmentJob> {
  const worker = new Worker<EnrichmentJob>(
    'enrichment',
    async (job: Job<EnrichmentJob>) => {
      const { entity, entityType, investigationId, userId, excludeModules, depth, maxDepth } = job.data;

      logger.info({ jobId: job.id, entity, entityType, depth, maxDepth }, 'Processing enrichment job');

      if (depth >= maxDepth) {
        logger.info({ entity, depth, maxDepth }, 'Max enrichment depth reached');
        return { skipped: true, reason: 'max depth reached' };
      }

      const targetModules = ENTITY_TYPE_MODULE_MAP[entityType] || [];
      const filteredModules = targetModules.filter((m) => {
        if (excludeModules?.includes(m)) return false;
        return moduleRegistry.has(m);
      });

      if (filteredModules.length === 0) {
        logger.warn({ entity, entityType }, 'No modules available for enrichment');
        return { skipped: true, reason: 'no modules available' };
      }

      const collectionJobs: CollectionJob[] = filteredModules.map((moduleName) => ({
        id: `enrich-${moduleName}-${entity}-${Date.now()}`,
        module: moduleName,
        entity,
        entityType,
        priority: 10,
        investigationId,
        userId,
      }));

      const bulkJobs = collectionJobs.map((cj) => ({
        name: cj.module,
        data: cj,
        opts: {
          priority: cj.priority,
          jobId: `enrich:${cj.module}:${entity}:${Date.now()}`,
        },
      }));

      const results = await collectionQueue.addBulk(bulkJobs);

      logger.info({
        jobId: job.id,
        entity,
        entityType,
        modulesQueued: filteredModules.length,
        jobIds: results.map((r) => r.id),
      }, 'Enrichment jobs queued');

      return {
        enriched: true,
        modulesQueued: filteredModules,
        jobCount: results.length,
      };
    },
    {
      connection,
      concurrency,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, entity: job?.data.entity, error: err.message }, 'Enrichment job failed');
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Enrichment worker error');
  });

  return worker;
}
