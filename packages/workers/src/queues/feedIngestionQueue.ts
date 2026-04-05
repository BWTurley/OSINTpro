import { Queue } from 'bullmq';
import type { FeedIngestionJob } from '../base/types.js';
import { queueConnection } from './connection.js';

export const feedIngestionQueue = new Queue<FeedIngestionJob>('feed-ingestion', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 15000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 1000 },
  },
});

export async function addFeedIngestionJob(
  job: FeedIngestionJob,
  priority?: number,
): Promise<string> {
  const opts: Record<string, unknown> = {
    priority: priority ?? 5,
    jobId: `feed:${job.feedId}:${Date.now()}`,
  };

  if (job.schedule) {
    opts.repeat = { pattern: job.schedule };
    opts.jobId = `feed:${job.feedId}`;
  }

  const added = await feedIngestionQueue.add('ingest', job, opts);
  return added.id || '';
}

export async function removeFeedSchedule(feedId: string): Promise<void> {
  const repeatableJobs = await feedIngestionQueue.getRepeatableJobs();
  for (const rj of repeatableJobs) {
    if (rj.id === `feed:${feedId}`) {
      await feedIngestionQueue.removeRepeatableByKey(rj.key);
    }
  }
}

export async function getFeedIngestionStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    feedIngestionQueue.getWaitingCount(),
    feedIngestionQueue.getActiveCount(),
    feedIngestionQueue.getCompletedCount(),
    feedIngestionQueue.getFailedCount(),
    feedIngestionQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
