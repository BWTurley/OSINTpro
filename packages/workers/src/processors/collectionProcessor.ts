import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import type { CollectionResult, CollectionJob } from '../base/types.js';
import type { BaseModule } from '../base/BaseModule.js';

const logger = pino({ name: 'collection-processor' });

export function createCollectionWorker(
  connection: Redis,
  moduleRegistry: Map<string, BaseModule>,
  concurrency: number = 5,
): Worker<CollectionJob, CollectionResult> {
  const worker = new Worker<CollectionJob, CollectionResult>(
    'collection',
    async (job: Job<CollectionJob, CollectionResult>) => {
      const { module: moduleName, entity, apiKey, entityType, investigationId, userId } = job.data;

      logger.info({ jobId: job.id, module: moduleName, entity, entityType, investigationId, userId }, 'Processing collection job');

      const moduleInstance = moduleRegistry.get(moduleName);
      if (!moduleInstance) {
        throw new Error(`Unknown module: ${moduleName}. Available: ${Array.from(moduleRegistry.keys()).join(', ')}`);
      }

      if (!moduleInstance.supportedEntityTypes.includes(entityType)) {
        throw new Error(
          `Module ${moduleName} does not support entity type ${entityType}. Supported: ${moduleInstance.supportedEntityTypes.join(', ')}`
        );
      }

      const result = await moduleInstance.collect(entity, apiKey);

      logger.info({
        jobId: job.id,
        module: moduleName,
        entity,
        success: result.success,
        entitiesFound: result.normalized.length,
        duration: result.metadata.duration,
        apiCalls: result.metadata.apiCalls,
        cached: result.metadata.cached,
        errors: result.errors.length,
      }, 'Collection job completed');

      return result;
    },
    {
      connection,
      concurrency,
      limiter: {
        max: 20,
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, module: job.data.module }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, module: job?.data.module, error: err.message }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Worker error');
  });

  return worker;
}
