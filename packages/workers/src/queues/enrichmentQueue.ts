import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { EnrichmentJob } from '../base/types.js';
import { queueConnection } from './connection.js';

export const enrichmentQueue = new Queue<EnrichmentJob>('enrichment', {
  connection: queueConnection,
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
    jobId: `enrich:${job.entityType}:${job.entity}:${job.depth}:${randomUUID()}`,
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
