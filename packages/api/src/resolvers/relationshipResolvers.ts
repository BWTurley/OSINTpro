import { PrismaClient } from '@prisma/client';
import { GraphService } from '../services/graphService.js';
import { AuditService } from '../services/auditService.js';
import { assertMinimumRole } from '../middleware/rbac.js';
import type { CreateRelationshipInput, UpdateRelationshipInput } from '../utils/validation.js';

interface GqlContext {
  user?: { id: string; role: string };
  prisma: PrismaClient;
  graphService: GraphService;
  auditService: AuditService;
}

export const relationshipResolvers = {
  Query: {
    relationships: async (
      _parent: unknown,
      args: { entityId: string },
      ctx: GqlContext,
    ) => {
      return ctx.prisma.relationship.findMany({
        where: {
          OR: [
            { sourceEntityId: args.entityId },
            { targetEntityId: args.entityId },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    relationship: async (
      _parent: unknown,
      args: { id: string },
      ctx: GqlContext,
    ) => {
      return ctx.prisma.relationship.findUnique({ where: { id: args.id } });
    },

    shortestPath: async (
      _parent: unknown,
      args: { sourceId: string; targetId: string; maxDepth?: number },
      ctx: GqlContext,
    ) => {
      return ctx.graphService.shortestPath(args.sourceId, args.targetId, args.maxDepth ?? 10);
    },

    entityGraph: async (
      _parent: unknown,
      args: { entityId: string; depth?: number },
      ctx: GqlContext,
    ) => {
      return ctx.graphService.entityGraph(args.entityId, args.depth ?? 2);
    },
  },

  Mutation: {
    createRelationship: async (
      _parent: unknown,
      args: { input: CreateRelationshipInput },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      const input = args.input;

      // Create in PostgreSQL
      const relationship = await ctx.prisma.relationship.create({
        data: {
          sourceEntityId: input.sourceEntityId,
          sourceEntityType: input.sourceEntityType,
          targetEntityId: input.targetEntityId,
          targetEntityType: input.targetEntityType,
          relationshipType: input.relationshipType,
          confidence: input.confidence ?? 0,
          admiraltySource: input.admiraltySource,
          admiraltyCredibility: input.admiraltyCredibility,
          source: input.source,
          description: input.description,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        },
      });

      // Sync to Neo4j
      try {
        await ctx.graphService.createRelationship(
          input.sourceEntityId,
          input.targetEntityId,
          input.relationshipType,
          {
            confidence: relationship.confidence,
            source: relationship.source ?? '',
            description: relationship.description ?? '',
          },
          relationship.id,
        );
      } catch {
        // Neo4j sync is best-effort
      }

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'RELATIONSHIP_CREATED',
        entityId: relationship.id,
        details: {
          sourceEntityId: input.sourceEntityId,
          targetEntityId: input.targetEntityId,
          type: input.relationshipType,
        },
      });

      return relationship;
    },

    updateRelationship: async (
      _parent: unknown,
      args: { id: string; input: UpdateRelationshipInput },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');

      const input = args.input;

      const relationship = await ctx.prisma.relationship.update({
        where: { id: args.id },
        data: {
          ...(input.relationshipType !== undefined && { relationshipType: input.relationshipType }),
          ...(input.confidence !== undefined && { confidence: input.confidence }),
          ...(input.admiraltySource !== undefined && { admiraltySource: input.admiraltySource }),
          ...(input.admiraltyCredibility !== undefined && { admiraltyCredibility: input.admiraltyCredibility }),
          ...(input.source !== undefined && { source: input.source }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.startDate !== undefined && { startDate: new Date(input.startDate) }),
          ...(input.endDate !== undefined && { endDate: new Date(input.endDate) }),
        },
      });

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'RELATIONSHIP_UPDATED',
        entityId: relationship.id,
        details: { updatedFields: Object.keys(input) },
      });

      return relationship;
    },

    deleteRelationship: async (
      _parent: unknown,
      args: { id: string },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ADMIN');

      await ctx.prisma.relationship.delete({ where: { id: args.id } });

      try {
        await ctx.graphService.deleteRelationship(args.id);
      } catch {
        // Best-effort Neo4j cleanup
      }

      await ctx.auditService.log({
        userId: ctx.user?.id,
        action: 'RELATIONSHIP_DELETED',
        entityId: args.id,
      });

      return true;
    },
  },

  Relationship: {
    sourceEntity: async (parent: { sourceEntityId: string }, _args: unknown, ctx: GqlContext) => {
      return ctx.prisma.entity.findUnique({ where: { id: parent.sourceEntityId } });
    },

    targetEntity: async (parent: { targetEntityId: string }, _args: unknown, ctx: GqlContext) => {
      return ctx.prisma.entity.findUnique({ where: { id: parent.targetEntityId } });
    },
  },
};
