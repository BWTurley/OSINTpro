import { PrismaClient } from '@prisma/client';
import { CollectionService } from '../services/collectionService.js';
import { EntityService } from '../services/entityService.js';
import { AuditService } from '../services/auditService.js';
import { assertMinimumRole } from '../middleware/rbac.js';
import { pubsub, EVENTS } from './subscriptionResolvers.js';
import type { CreateEntityInput } from '../utils/validation.js';

interface GqlContext {
  user?: { id: string; role: string };
  prisma: PrismaClient;
  collectionService: CollectionService;
  entityService: EntityService;
  auditService: AuditService;
}

export const collectionResolvers = {
  Query: {
    collectionJobs: async (
      _parent: unknown,
      args: { entityId?: string },
      ctx: GqlContext,
    ) => {
      if (args.entityId) {
        return ctx.prisma.collectionJob.findMany({
          where: { entityId: args.entityId },
          orderBy: { createdAt: 'desc' },
        });
      }
      return ctx.prisma.collectionJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    },

    collectionJob: async (
      _parent: unknown,
      args: { id: string },
      ctx: GqlContext,
    ) => {
      return ctx.prisma.collectionJob.findUnique({ where: { id: args.id } });
    },

    queueStats: async (
      _parent: unknown,
      _args: unknown,
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ADMIN');
      return ctx.collectionService.getQueueStats();
    },
  },

  Mutation: {
    triggerCollection: async (
      _parent: unknown,
      args: { input: { entityId: string; modules: string[] } },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      // Verify entity exists
      const entity = await ctx.prisma.entity.findUnique({ where: { id: args.input.entityId } });
      if (!entity) throw new Error('Entity not found');

      const jobId = await ctx.collectionService.triggerCollection(
        args.input.entityId,
        args.input.modules,
      );

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'COLLECTION_TRIGGERED',
        entityId: args.input.entityId,
        details: { jobId, modules: args.input.modules },
      });

      const job = await ctx.prisma.collectionJob.findUnique({ where: { id: jobId } });
      if (job) {
        pubsub.publish(EVENTS.COLLECTION_JOB_UPDATED, { collectionJobUpdated: job });
      }
      return job;
    },

    cancelCollection: async (
      _parent: unknown,
      args: { jobId: string },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      const cancelled = await ctx.collectionService.cancelJob(args.jobId);

      if (cancelled) {
        await ctx.auditService.log({
          userId: ctx.user?.id,
          action: 'COLLECTION_CANCELLED',
          details: { jobId: args.jobId },
        });
      }

      return cancelled;
    },

    bulkImport: async (
      _parent: unknown,
      args: { input: { entities: CreateEntityInput[] } },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      const imported: Array<Record<string, unknown>> = [];
      const errors: string[] = [];

      for (const entityInput of args.input.entities) {
        try {
          const entity = await ctx.entityService.create(entityInput, ctx.user?.id);
          imported.push(entity as unknown as Record<string, unknown>);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Failed to import ${entityInput.entityType}: ${message}`);
        }
      }

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'BULK_IMPORT',
        details: {
          total: args.input.entities.length,
          imported: imported.length,
          failed: errors.length,
        },
      });

      return {
        imported: imported.length,
        failed: errors.length,
        errors,
        entities: imported,
      };
    },
  },
};
