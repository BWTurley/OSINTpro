import { PrismaClient, CaseStatus } from '@prisma/client';
import { AuditService } from '../services/auditService.js';
import { assertMinimumRole } from '../middleware/rbac.js';
import type { CreateCaseInput, UpdateCaseInput } from '../utils/validation.js';

interface GqlContext {
  user?: { id: string; role: string };
  prisma: PrismaClient;
  auditService: AuditService;
}

export const caseResolvers = {
  Query: {
    case: async (
      _parent: unknown,
      args: { id: string },
      ctx: GqlContext,
    ) => {
      return ctx.prisma.case.findUnique({
        where: { id: args.id },
        include: { createdBy: true },
      });
    },

    cases: async (
      _parent: unknown,
      args: { status?: CaseStatus; first?: number; after?: string },
      ctx: GqlContext,
    ) => {
      const where: Record<string, unknown> = {};
      if (args.status) where.status = args.status;

      const take = (args.first ?? 25) + 1;
      const cursor = args.after ? { id: args.after } : undefined;
      const skip = cursor ? 1 : 0;

      const cases = await ctx.prisma.case.findMany({
        where,
        take,
        skip,
        cursor,
        orderBy: { updatedAt: 'desc' },
        include: { createdBy: true },
      });

      const limit = args.first ?? 25;
      return cases.slice(0, limit);
    },
  },

  Mutation: {
    createCase: async (
      _parent: unknown,
      args: { input: CreateCaseInput },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      if (!ctx.user) throw new Error('Authentication required');

      const caseRecord = await ctx.prisma.case.create({
        data: {
          name: args.input.name,
          description: args.input.description,
          status: (args.input.status as CaseStatus) ?? CaseStatus.OPEN,
          createdById: ctx.user.id,
          tlpLevel: args.input.tlpLevel as 'WHITE' | 'GREEN' | 'AMBER' | 'AMBER_STRICT' | 'RED' ?? 'WHITE',
          tags: args.input.tags ?? [],
        },
        include: { createdBy: true },
      });

      await ctx.auditService.log({
        userId: ctx.user.id,
        action: 'CASE_CREATED',
        entityId: caseRecord.id,
        details: { name: caseRecord.name },
      });

      return caseRecord;
    },

    updateCase: async (
      _parent: unknown,
      args: { id: string; input: UpdateCaseInput },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      const input = args.input;
      const caseRecord = await ctx.prisma.case.update({
        where: { id: args.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.status !== undefined && { status: input.status as CaseStatus }),
          ...(input.tlpLevel !== undefined && { tlpLevel: input.tlpLevel as 'WHITE' | 'GREEN' | 'AMBER' | 'AMBER_STRICT' | 'RED' }),
          ...(input.tags !== undefined && { tags: input.tags }),
        },
        include: { createdBy: true },
      });

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'CASE_UPDATED',
        entityId: caseRecord.id,
        details: { updatedFields: Object.keys(input) },
      });

      return caseRecord;
    },

    addEntityToCase: async (
      _parent: unknown,
      args: { caseId: string; entityId: string },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      // Check both exist
      const [caseRecord, entity] = await Promise.all([
        ctx.prisma.case.findUnique({ where: { id: args.caseId } }),
        ctx.prisma.entity.findUnique({ where: { id: args.entityId } }),
      ]);

      if (!caseRecord) throw new Error('Case not found');
      if (!entity) throw new Error('Entity not found');

      // Upsert to avoid duplicate errors
      await ctx.prisma.caseEntity.upsert({
        where: {
          caseId_entityId: { caseId: args.caseId, entityId: args.entityId },
        },
        create: { caseId: args.caseId, entityId: args.entityId },
        update: {},
      });

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'ENTITY_ADDED_TO_CASE',
        entityId: args.entityId,
        details: { caseId: args.caseId },
      });

      return ctx.prisma.case.findUnique({
        where: { id: args.caseId },
        include: { createdBy: true },
      });
    },

    removeEntityFromCase: async (
      _parent: unknown,
      args: { caseId: string; entityId: string },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      await ctx.prisma.caseEntity.delete({
        where: {
          caseId_entityId: { caseId: args.caseId, entityId: args.entityId },
        },
      });

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'ENTITY_REMOVED_FROM_CASE',
        entityId: args.entityId,
        details: { caseId: args.caseId },
      });

      return ctx.prisma.case.findUnique({
        where: { id: args.caseId },
        include: { createdBy: true },
      });
    },

    addNote: async (
      _parent: unknown,
      args: { input: { entityId: string; caseId?: string; content: string; classification?: string } },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      if (!ctx.user) throw new Error('Authentication required');

      const note = await ctx.prisma.note.create({
        data: {
          entityId: args.input.entityId,
          caseId: args.input.caseId,
          content: args.input.content,
          authorId: ctx.user.id,
          classification: args.input.classification,
        },
        include: { author: true },
      });

      return note;
    },
  },

  Case: {
    entities: async (parent: { id: string }, _args: unknown, ctx: GqlContext) => {
      const caseEntities = await ctx.prisma.caseEntity.findMany({
        where: { caseId: parent.id },
        include: { entity: true },
      });
      return caseEntities.map((ce) => ce.entity);
    },

    notes: async (parent: { id: string }, _args: unknown, ctx: GqlContext) => {
      return ctx.prisma.note.findMany({
        where: { caseId: parent.id },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    entityCount: async (parent: { id: string }, _args: unknown, ctx: GqlContext) => {
      return ctx.prisma.caseEntity.count({ where: { caseId: parent.id } });
    },
  },

  Note: {
    author: async (parent: { authorId: string; author?: unknown }, _args: unknown, ctx: GqlContext) => {
      if (parent.author) return parent.author;
      return ctx.prisma.user.findUnique({ where: { id: parent.authorId } });
    },
  },
};
