import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { CollectionJob } from '../base/types.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const collectionQueue = new Queue<CollectionJob>('collection', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export async function addCollectionJob(
  job: CollectionJob,
  priority?: number,
): Promise<string> {
  const added = await collectionQueue.add(job.module, job, {
    priority: priority ?? job.priority,
    jobId: `${job.module}:${job.entity}:${Date.now()}`,
  });
  return added.id || '';
}

export async function addBulkCollectionJobs(
  jobs: CollectionJob[],
): Promise<string[]> {
  const bulkJobs = jobs.map((job) => ({
    name: job.module,
    data: job,
    opts: {
      priority: job.priority,
      jobId: `${job.module}:${job.entity}:${Date.now()}`,
    },
  }));
  const results = await collectionQueue.addBulk(bulkJobs);
  return results.map((r) => r.id || '');
}

export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    collectionQueue.getWaitingCount(),
    collectionQueue.getActiveCount(),
    collectionQueue.getCompletedCount(),
    collectionQueue.getFailedCount(),
    collectionQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
