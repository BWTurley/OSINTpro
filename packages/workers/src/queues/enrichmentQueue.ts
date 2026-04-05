import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { EnrichmentJob } from '../base/types.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const enrichmentQueue = new Queue<EnrichmentJob>('enrichment', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 2000 },
  },
});

export async function addEnrichmentJob(
  job: EnrichmentJob,
  priority?: number,
): Promise<string> {
  const added = await enrichmentQueue.add('enrich', job, {
    priority: priority ?? 5,
    jobId: `enrich:${job.entityType}:${job.entity}:${job.depth}:${Date.now()}`,
  });
  return added.id || '';
}

export async function getEnrichmentStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    enrichmentQueue.getWaitingCount(),
    enrichmentQueue.getActiveCount(),
    enrichmentQueue.getCompletedCount(),
    enrichmentQueue.getFailedCount(),
    enrichmentQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
