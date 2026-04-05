import { Prisma, PrismaClient } from '@prisma/client';
import { GraphService } from '../services/graphService.js';
import { AuditService } from '../services/auditService.js';
import { encrypt } from '../utils/crypto.js';
import { assertRole } from '../middleware/rbac.js';

interface GqlContext {
  user?: { id: string; role: string };
  prisma: PrismaClient;
  graphService: GraphService;
  auditService: AuditService;
}

export const adminResolvers = {
  Query: {
    moduleStatus: async (
      _parent: unknown,
      _args: unknown,
      ctx: GqlContext,
    ) => {
      const configs = await ctx.prisma.apiKeyConfig.findMany({
        orderBy: { moduleName: 'asc' },
      });

      return configs.map((c) => ({
        moduleName: c.moduleName,
        enabled: c.enabled,
        configured: c.encryptedKey.length > 0,
        lastUsed: null, // TODO: track last usage timestamp
      }));
    },

    auditLogs: async (
      _parent: unknown,
      args: {
        userId?: string;
        action?: string;
        entityType?: string;
        from?: string;
        to?: string;
        page?: number;
        size?: number;
      },
      ctx: GqlContext,
    ) => {
      assertRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, ['ADMIN']);

      const result = await ctx.auditService.search({
        userId: args.userId,
        action: args.action,
        entityType: args.entityType,
        from: args.from ? new Date(args.from) : undefined,
        to: args.to ? new Date(args.to) : undefined,
        page: args.page,
        size: args.size,
      });

      return result.items;
    },

    communityDetection: async (
      _parent: unknown,
      _args: unknown,
      ctx: GqlContext,
    ) => {
      assertRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, ['ADMIN', 'ANALYST']);
      return ctx.graphService.communityDetection();
    },

    centralityAnalysis: async (
      _parent: unknown,
      _args: unknown,
      ctx: GqlContext,
    ) => {
      assertRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, ['ADMIN', 'ANALYST']);
      return ctx.graphService.centralityAnalysis();
    },
  },

  Mutation: {
    updateModuleConfig: async (
      _parent: unknown,
      args: {
        input: {
          moduleName: string;
          apiKey: string;
          enabled?: boolean;
          config?: Record<string, unknown>;
        };
      },
      ctx: GqlContext,
    ) => {
      assertRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, ['ADMIN']);

      const encryptedKey = encrypt(args.input.apiKey);

      const result = await ctx.prisma.apiKeyConfig.upsert({
        where: { moduleName: args.input.moduleName },
        create: {
          moduleName: args.input.moduleName,
          encryptedKey,
          enabled: args.input.enabled ?? true,
          config: (args.input.config ?? {}) as Prisma.InputJsonValue,
        },
        update: {
          encryptedKey,
          enabled: args.input.enabled ?? true,
          config: (args.input.config ?? {}) as Prisma.InputJsonValue,
        },
      });

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'MODULE_CONFIG_UPDATED',
        details: { moduleName: args.input.moduleName },
      });

      return result;
    },

    createScheduledJob: async (
      _parent: unknown,
      args: {
        input: {
          name: string;
          cronExpression: string;
          moduleNames: string[];
          entityFilter?: Record<string, unknown>;
          enabled?: boolean;
        };
      },
      ctx: GqlContext,
    ) => {
      assertRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, ['ADMIN']);

      const job = await ctx.prisma.scheduledJob.create({
        data: {
          name: args.input.name,
          cronExpression: args.input.cronExpression,
          moduleNames: args.input.moduleNames,
          entityFilter: (args.input.entityFilter ?? undefined) as Prisma.InputJsonValue | undefined,
          enabled: args.input.enabled ?? true,
        },
      });

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'SCHEDULED_JOB_CREATED',
        details: { jobId: job.id, name: job.name },
      });

      return job;
    },
  },
};
