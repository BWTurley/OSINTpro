import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import type { NormalizedEntity } from '../base/types.js';

const logger = pino({ name: 'dedup-processor' });

interface DeduplicationJob {
  investigationId: string;
  entities: NormalizedEntity[];
  strategy: 'strict' | 'fuzzy';
}

interface DeduplicationResult {
  merged: number;
  kept: number;
  mergeGroups: Array<{ canonical: string; merged: string[] }>;
}

function normalizeForComparison(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function calculateSimilarity(a: string, b: string): number {
  const na = normalizeForComparison(a);
  const nb = normalizeForComparison(b);

  if (na === nb) return 1.0;
  if (na.length === 0 || nb.length === 0) return 0;

  // Check if one contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  // Levenshtein-based similarity
  const maxLen = Math.max(na.length, nb.length);
  const distance = levenshteinDistance(na, nb);
  return 1 - distance / maxLen;
}

function mergeEntities(canonical: NormalizedEntity, duplicate: NormalizedEntity): NormalizedEntity {
  return {
    ...canonical,
    description: canonical.description || duplicate.description,
    attributes: { ...duplicate.attributes, ...canonical.attributes },
    confidence: Math.max(canonical.confidence, duplicate.confidence),
    tags: [...new Set([...canonical.tags, ...duplicate.tags])],
    firstSeen: canonical.firstSeen < duplicate.firstSeen ? canonical.firstSeen : duplicate.firstSeen,
    lastSeen: canonical.lastSeen > duplicate.lastSeen ? canonical.lastSeen : duplicate.lastSeen,
  };
}

export function createDeduplicationWorker(
  connection: Redis,
  concurrency: number = 2,
): Worker<DeduplicationJob, DeduplicationResult> {
  const worker = new Worker<DeduplicationJob, DeduplicationResult>(
    'deduplication',
    async (job: Job<DeduplicationJob, DeduplicationResult>) => {
      const { entities, strategy, investigationId } = job.data;
      const threshold = strategy === 'strict' ? 0.95 : 0.8;

      logger.info({ jobId: job.id, investigationId, entityCount: entities.length, strategy }, 'Processing deduplication');

      // Group entities by type first
      const byType = new Map<string, NormalizedEntity[]>();
      for (const entity of entities) {
        const group = byType.get(entity.type) || [];
        group.push(entity);
        byType.set(entity.type, group);
      }

      const mergeGroups: Array<{ canonical: string; merged: string[] }> = [];
      let totalMerged = 0;

      for (const [_type, typeEntities] of byType) {
        const processed = new Set<string>();

        for (let i = 0; i < typeEntities.length; i++) {
          if (processed.has(typeEntities[i].id)) continue;

          const duplicates: number[] = [];

          for (let j = i + 1; j < typeEntities.length; j++) {
            if (processed.has(typeEntities[j].id)) continue;

            const similarity = calculateSimilarity(typeEntities[i].name, typeEntities[j].name);

            if (similarity >= threshold) {
              duplicates.push(j);
              processed.add(typeEntities[j].id);
            }
          }

          if (duplicates.length > 0) {
            const mergedIds: string[] = [];
            let canonical = typeEntities[i];

            for (const dupIdx of duplicates) {
              mergedIds.push(typeEntities[dupIdx].id);
              canonical = mergeEntities(canonical, typeEntities[dupIdx]);
            }

            mergeGroups.push({
              canonical: canonical.id,
              merged: mergedIds,
            });
            totalMerged += mergedIds.length;
          }
        }
      }

      const result: DeduplicationResult = {
        merged: totalMerged,
        kept: entities.length - totalMerged,
        mergeGroups,
      };

      logger.info({
        jobId: job.id,
        investigationId,
        merged: result.merged,
        kept: result.kept,
        groups: mergeGroups.length,
      }, 'Deduplication completed');

      return result;
    },
    {
      connection,
      concurrency,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Deduplication job failed');
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Deduplication worker error');
  });

  return worker;
}
