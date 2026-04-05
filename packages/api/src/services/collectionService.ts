import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { PrismaClient, JobStatus } from '@prisma/client';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface CollectionJobPayload {
  jobId: string;
  entityId: string;
  modules: string[];
}

export interface CollectionResult {
  module: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export class CollectionService {
  private queue: Queue;
  private queueEvents: QueueEvents;
  private worker: Worker | null = null;
  private connection: IORedis;

  constructor(private prisma: PrismaClient) {
    this.connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
    this.queue = new Queue('collection', { connection: this.connection });
    this.queueEvents = new QueueEvents('collection', { connection: this.connection.duplicate() });
  }

  async startWorker(
    processJob: (payload: CollectionJobPayload) => Promise<CollectionResult[]>,
  ): Promise<void> {
    this.worker = new Worker(
      'collection',
      async (job: Job<CollectionJobPayload>) => {
        const { jobId, entityId, modules } = job.data;

        // Mark as running
        await this.prisma.collectionJob.update({
          where: { id: jobId },
          data: { status: JobStatus.RUNNING, progress: 0 },
        });

        try {
          const results = await processJob(job.data);

          const allSucceeded = results.every((r) => r.success);
          const status = allSucceeded ? JobStatus.COMPLETED : JobStatus.FAILED;
          const error = results
            .filter((r) => !r.success)
            .map((r) => `${r.module}: ${r.error}`)
            .join('; ');

          await this.prisma.collectionJob.update({
            where: { id: jobId },
            data: {
              status,
              progress: 1,
              results: results as unknown as Record<string, unknown>[],
              error: error || null,
              completedAt: new Date(),
            },
          });

          return results;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          await this.prisma.collectionJob.update({
            where: { id: jobId },
            data: {
              status: JobStatus.FAILED,
              error: message,
              completedAt: new Date(),
            },
          });
          throw err;
        }
      },
      {
        connection: this.connection.duplicate(),
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Collection job completed');
    });

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err: err.message }, 'Collection job failed');
    });

    logger.info('Collection worker started');
  }

  async triggerCollection(entityId: string, modules: string[]): Promise<string> {
    // Create job record in Postgres
    const dbJob = await this.prisma.collectionJob.create({
      data: {
        entityId,
        modules,
        status: JobStatus.PENDING,
        progress: 0,
      },
    });

    // Enqueue in BullMQ
    await this.queue.add('collect', {
      jobId: dbJob.id,
      entityId,
      modules,
    } satisfies CollectionJobPayload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    });

    logger.info({ jobId: dbJob.id, entityId, modules }, 'Collection job queued');
    return dbJob.id;
  }

  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: string;
    progress: number;
    results: unknown;
    error: string | null;
  } | null> {
    const job = await this.prisma.collectionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return null;

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      results: job.results,
      error: job.error,
    };
  }

  async getJobsByEntity(entityId: string): Promise<Array<{
    id: string;
    modules: string[];
    status: string;
    progress: number;
    createdAt: Date;
    completedAt: Date | null;
  }>> {
    return this.prisma.collectionJob.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        modules: true,
        status: true,
        progress: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const dbJob = await this.prisma.collectionJob.findUnique({ where: { id: jobId } });
    if (!dbJob || dbJob.status === 'COMPLETED' || dbJob.status === 'FAILED') {
      return false;
    }

    await this.prisma.collectionJob.update({
      where: { id: jobId },
      data: { status: JobStatus.CANCELLED, completedAt: new Date() },
    });

    // Try to remove from queue
    const bullJobs = await this.queue.getJobs(['waiting', 'delayed']);
    for (const bullJob of bullJobs) {
      if (bullJob.data.jobId === jobId) {
        await bullJob.remove();
        break;
      }
    }

    return true;
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queueEvents.close();
    await this.queue.close();
    await this.connection.quit();
  }
}
