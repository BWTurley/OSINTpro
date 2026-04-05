import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { AlertJob } from '../base/types.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const scheduledQueue = new Queue<AlertJob>('scheduled', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export async function addScheduledJob(
  job: AlertJob,
  repeatPattern?: string,
): Promise<string> {
  const opts: Record<string, unknown> = {
    jobId: `scheduled:${job.alertId}`,
  };

  if (repeatPattern) {
    opts.repeat = { pattern: repeatPattern };
  }

  const added = await scheduledQueue.add('scheduled-check', job, opts);
  return added.id || '';
}

export async function removeScheduledJob(alertId: string): Promise<void> {
  const repeatableJobs = await scheduledQueue.getRepeatableJobs();
  for (const rj of repeatableJobs) {
    if (rj.id === `scheduled:${alertId}`) {
      await scheduledQueue.removeRepeatableByKey(rj.key);
    }
  }
}

export async function listScheduledJobs(): Promise<Array<{
  id: string;
  name: string;
  next: number;
  pattern: string;
}>> {
  const repeatableJobs = await scheduledQueue.getRepeatableJobs();
  return repeatableJobs.map((rj) => ({
    id: rj.id || '',
    name: rj.name,
    next: rj.next,
    pattern: rj.pattern || '',
  }));
}

export async function getScheduledStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    scheduledQueue.getWaitingCount(),
    scheduledQueue.getActiveCount(),
    scheduledQueue.getCompletedCount(),
    scheduledQueue.getFailedCount(),
    scheduledQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
