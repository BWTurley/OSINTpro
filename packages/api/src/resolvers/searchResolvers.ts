import { Prisma, PrismaClient } from '@prisma/client';
import { SearchService } from '../services/searchService.js';
import { assertMinimumRole } from '../middleware/rbac.js';

interface GqlContext {
  user?: { id: string; role: string };
  prisma: PrismaClient;
  searchService: SearchService;
}

export const searchResolvers = {
  Query: {
    searchEntities: async (
      _parent: unknown,
      args: {
        input: {
          query: string;
          entityTypes?: string[];
          tlpLevels?: string[];
          tags?: string[];
          dateFrom?: string;
          dateTo?: string;
          page?: number;
          size?: number;
        };
      },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'VIEWER');
      return ctx.searchService.search({
        query: args.input.query,
        entityTypes: args.input.entityTypes,
        tlpLevels: args.input.tlpLevels,
        tags: args.input.tags,
        dateFrom: args.input.dateFrom,
        dateTo: args.input.dateTo,
        page: args.input.page,
        size: args.input.size,
      });
    },

    search: async (
      _parent: unknown,
      args: {
        input: {
          query: string;
          entityTypes?: string[];
          tlpLevels?: string[];
          tags?: string[];
          dateFrom?: string;
          dateTo?: string;
          page?: number;
          size?: number;
        };
      },
      ctx: GqlContext,
    ) => {
      return searchResolvers.Query.searchEntities(_parent, args, ctx);
    },

    suggest: async (
      _parent: unknown,
      args: { prefix: string; size?: number },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'VIEWER');
      return ctx.searchService.suggest(args.prefix, args.size ?? 5);
    },

    dashboardStats: async (
      _parent: unknown,
      _args: unknown,
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'VIEWER');
      const [
        totalEntities,
        totalRelationships,
        totalCases,
        entitiesByTypeRaw,
        recentEntities,
        activeCases,
        activeJobs,
      ] = await Promise.all([
        ctx.prisma.entity.count(),
        ctx.prisma.relationship.count(),
        ctx.prisma.case.count(),
        ctx.prisma.entity.groupBy({
          by: ['entityType'],
          _count: true,
        }),
        ctx.prisma.entity.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        ctx.prisma.case.findMany({
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
          include: { createdBy: true },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        }),
        ctx.prisma.collectionJob.count({
          where: { status: { in: ['PENDING', 'RUNNING'] } },
        }),
      ]);

      const entitiesByType: Record<string, number> = {};
      for (const row of entitiesByTypeRaw) {
        entitiesByType[row.entityType] = row._count;
      }

      return {
        totalEntities,
        totalRelationships,
        totalCases,
        entitiesByType,
        recentEntities,
        activeCases,
        activeJobs,
      };
    },

    threatFeed: async (
      _parent: unknown,
      args: { limit?: number; tlpLevel?: string },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'VIEWER');
      const where: Record<string, unknown> = {
        entityType: { in: ['IP_ADDRESS', 'DOMAIN', 'EMAIL'] },
        confidence: { gte: 0.5 },
      };

      if (args.tlpLevel) {
        where.tlpLevel = args.tlpLevel;
      }

      const entities = await ctx.prisma.entity.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: args.limit ?? 50,
      });

      return entities.map((e) => {
        const data = e.data as Record<string, unknown>;
        return {
          id: e.id,
          entityType: e.entityType,
          value: String(data.value ?? data.name ?? ''),
          confidence: e.confidence,
          tlpLevel: e.tlpLevel,
          tags: e.tags,
          firstSeen: e.createdAt,
          lastSeen: e.updatedAt,
        };
      });
    },

    savedSearches: async (
      _parent: unknown,
      _args: unknown,
      ctx: GqlContext,
    ) => {
      if (!ctx.user) throw new Error('Authentication required');
      return ctx.prisma.savedSearch.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: 'desc' },
      });
    },

    savedSearch: async (
      _parent: unknown,
      args: { id: string },
      ctx: GqlContext,
    ) => {
      return ctx.prisma.savedSearch.findUnique({ where: { id: args.id } });
    },
  },

  Mutation: {
    createSavedSearch: async (
      _parent: unknown,
      args: { name: string; query: Record<string, unknown>; alertEnabled?: boolean; alertChannels?: unknown },
      ctx: GqlContext,
    ) => {
      if (!ctx.user) throw new Error('Authentication required');

      return ctx.prisma.savedSearch.create({
        data: {
          name: args.name,
          query: args.query as Prisma.InputJsonValue,
          userId: ctx.user.id,
          alertEnabled: args.alertEnabled ?? false,
          alertChannels: (args.alertChannels ?? []) as Prisma.InputJsonValue,
        },
      });
    },

    deleteSavedSearch: async (
      _parent: unknown,
      args: { id: string },
      ctx: GqlContext,
    ) => {
      if (!ctx.user) throw new Error('Authentication required');

      const search = await ctx.prisma.savedSearch.findUnique({ where: { id: args.id } });
      if (!search || search.userId !== ctx.user.id) {
        throw new Error('Saved search not found');
      }

      await ctx.prisma.savedSearch.delete({ where: { id: args.id } });
      return true;
    },
  },
};
