import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';
import { EntityService } from '../services/entityService.js';
import { assertMinimumRole } from '../middleware/rbac.js';
import { encodeCursor } from '../utils/pagination.js';
import { pubsub, EVENTS } from './subscriptionResolvers.js';
import type { CreateEntityInput, UpdateEntityInput } from '../utils/validation.js';

// We define a minimal DataLoader inline since we didn't add the package.
// In production, install 'dataloader' and import it properly.
interface GqlContext {
  user?: { id: string; role: string };
  prisma: PrismaClient;
  entityService: EntityService;
  entityLoader: {
    load: (id: string) => Promise<Record<string, unknown> | null>;
  };
}

export function createEntityLoader(prisma: PrismaClient) {
  const batchFn = async (ids: readonly string[]) => {
    const entities = await prisma.entity.findMany({
      where: { id: { in: [...ids] } },
    });
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    return ids.map((id) => entityMap.get(id) ?? null);
  };

  // Simple DataLoader implementation
  const cache = new Map<string, Promise<Record<string, unknown> | null>>();
  let queue: Array<{ id: string; resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
  let scheduled = false;

  function dispatch() {
    const batch = queue;
    queue = [];
    scheduled = false;

    const ids = batch.map((item) => item.id);
    batchFn(ids)
      .then((results) => {
        batch.forEach((item, i) => {
          item.resolve(results[i] as Record<string, unknown> | null);
        });
      })
      .catch((err) => {
        batch.forEach((item) => item.reject(err));
      });
  }

  return {
    load(id: string): Promise<Record<string, unknown> | null> {
      if (cache.has(id)) return cache.get(id)!;

      const promise = new Promise<Record<string, unknown> | null>((resolve, reject) => {
        queue.push({ id, resolve: resolve as (v: unknown) => void, reject });
        if (!scheduled) {
          scheduled = true;
          process.nextTick(dispatch);
        }
      });

      cache.set(id, promise);
      return promise;
    },
    clear(id: string) {
      cache.delete(id);
    },
    clearAll() {
      cache.clear();
    },
  };
}

export const entityResolvers = {
  Query: {
    entity: async (
      _parent: unknown,
      args: { id: string },
      ctx: GqlContext,
    ) => {
      return ctx.entityService.findById(args.id);
    },

    entities: async (
      _parent: unknown,
      args: { filter?: { entityType?: string; tags?: string[]; tlpLevel?: string; first?: number; after?: string } },
      ctx: GqlContext,
    ) => {
      const filter = args.filter ?? {};
      const first = filter.first ?? 25;
      const { entities, total } = await ctx.entityService.findMany({
        entityType: filter.entityType,
        tags: filter.tags,
        tlpLevel: filter.tlpLevel,
        first,
        after: filter.after,
      });

      const hasMore = entities.length > first;
      const trimmed = hasMore ? entities.slice(0, first) : entities;

      return {
        edges: trimmed.map((e) => ({
          node: e,
          cursor: encodeCursor(e.id),
        })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: !!filter.after,
          startCursor: trimmed.length > 0 ? encodeCursor(trimmed[0].id) : null,
          endCursor: trimmed.length > 0 ? encodeCursor(trimmed[trimmed.length - 1].id) : null,
          totalCount: total,
        },
      };
    },
  },

  Mutation: {
    createEntity: async (
      _parent: unknown,
      args: { input: CreateEntityInput },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');
      const entity = await ctx.entityService.create(args.input, ctx.user?.id);
      pubsub.publish(EVENTS.ENTITY_UPDATED, { entityUpdated: entity });
      return entity;
    },

    updateEntity: async (
      _parent: unknown,
      args: { id: string; input: UpdateEntityInput },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');
      const entity = await ctx.entityService.update(args.id, args.input, ctx.user?.id);
      pubsub.publish(EVENTS.ENTITY_UPDATED, { entityUpdated: entity });
      return entity;
    },

    mergeEntities: async (
      _parent: unknown,
      args: { sourceId: string; targetId: string },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ANALYST');
      return ctx.entityService.mergeEntities(args.sourceId, args.targetId, ctx.user?.id);
    },

    deleteEntity: async (
      _parent: unknown,
      args: { id: string },
      ctx: GqlContext,
    ) => {
      assertMinimumRole(ctx.user?.role as 'ADMIN' | 'ANALYST' | 'VIEWER' | 'API_USER' | undefined, 'ADMIN');
      return ctx.entityService.delete(args.id, ctx.user?.id);
    },
  },

  Entity: {
    relationships: async (parent: { id: string }, _args: unknown, ctx: GqlContext) => {
      return ctx.prisma.relationship.findMany({
        where: {
          OR: [
            { sourceEntityId: parent.id },
            { targetEntityId: parent.id },
          ],
        },
      });
    },

    notes: async (parent: { id: string }, _args: unknown, ctx: GqlContext) => {
      return ctx.prisma.note.findMany({
        where: { entityId: parent.id },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    cases: async (parent: { id: string }, _args: unknown, ctx: GqlContext) => {
      const caseEntities = await ctx.prisma.caseEntity.findMany({
        where: { entityId: parent.id },
        include: { case: { include: { createdBy: true } } },
      });
      return caseEntities.map((ce) => ce.case);
    },
  },
};
