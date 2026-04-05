import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import type { AlertJob, CollectionJob } from '../base/types.js';
import type { BaseModule } from '../base/BaseModule.js';
import { collectionQueue } from '../queues/collectionQueue.js';

const logger = pino({ name: 'alert-processor' });

interface AlertResult {
  alertId: string;
  matches: number;
  newEntities: number;
  modules: string[];
  timestamp: string;
}

export function createAlertWorker(
  connection: Redis,
  moduleRegistry: Map<string, BaseModule>,
  concurrency: number = 2,
): Worker<AlertJob, AlertResult> {
  const worker = new Worker<AlertJob, AlertResult>(
    'scheduled',
    async (job: Job<AlertJob, AlertResult>) => {
      const { alertId, userId, query, modules, lastRun } = job.data;

      logger.info({ jobId: job.id, alertId, query, modules: modules.length }, 'Processing alert check');

      const availableModules = modules.filter((m) => moduleRegistry.has(m));

      if (availableModules.length === 0) {
        logger.warn({ alertId, modules }, 'No valid modules for alert');
        return {
          alertId,
          matches: 0,
          newEntities: 0,
          modules: [],
          timestamp: new Date().toISOString(),
        };
      }

      // Queue collection jobs for each module
      const collectionJobs: CollectionJob[] = availableModules.map((moduleName) => {
        const moduleInstance = moduleRegistry.get(moduleName)!;
        const entityType = moduleInstance.supportedEntityTypes[0];
        return {
          id: `alert-${alertId}-${moduleName}-${Date.now()}`,
          module: moduleName,
          entity: query,
          entityType,
          priority: 15, // Lowest priority - background alert checks
          investigationId: `alert-${alertId}`,
          userId,
        };
      });

      const bulkJobs = collectionJobs.map((cj) => ({
        name: cj.module,
        data: cj,
        opts: {
          priority: cj.priority,
          jobId: `alert:${alertId}:${cj.module}:${Date.now()}`,
        },
      }));

      const results = await collectionQueue.addBulk(bulkJobs);

      // Store last run timestamp in Redis for comparison
      const alertKey = `alert:lastrun:${alertId}`;
      await connection.set(alertKey, new Date().toISOString());

      const result: AlertResult = {
        alertId,
        matches: results.length,
        newEntities: 0,
        modules: availableModules,
        timestamp: new Date().toISOString(),
      };

      logger.info({
        jobId: job.id,
        alertId,
        modulesChecked: availableModules.length,
        jobsQueued: results.length,
      }, 'Alert check completed');

      return result;
    },
    {
      connection,
      concurrency,
    },
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, alertId: job.data.alertId }, 'Alert check completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, alertId: job?.data.alertId, error: err.message }, 'Alert check failed');
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Alert worker error');
  });

  return worker;
}
