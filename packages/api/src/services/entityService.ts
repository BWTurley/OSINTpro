import { PrismaClient, Entity, TLPLevel } from '@prisma/client';
import { SearchService } from './searchService.js';
import { GraphService } from './graphService.js';
import { AuditService } from './auditService.js';
import { logger } from '../utils/logger.js';
import type { CreateEntityInput, UpdateEntityInput } from '../utils/validation.js';

export class EntityService {
  constructor(
    private prisma: PrismaClient,
    private searchService: SearchService,
    private graphService: GraphService,
    private auditService: AuditService,
  ) {}

  async create(input: CreateEntityInput, userId?: string): Promise<Entity> {
    // Create in PostgreSQL
    const entity = await this.prisma.entity.create({
      data: {
        entityType: input.entityType,
        data: input.data,
        confidence: input.confidence,
        admiraltySource: input.admiraltySource,
        admiraltyCredibility: input.admiraltyCredibility,
        tlpLevel: input.tlpLevel as TLPLevel,
        tags: input.tags,
        sources: input.sources,
      },
    });

    // Sync to Elasticsearch
    try {
      await this.searchService.indexEntity(entity);
    } catch (err) {
      logger.error({ err, entityId: entity.id }, 'Failed to index entity in Elasticsearch');
    }

    // Sync to Neo4j
    try {
      await this.graphService.createNode(entity.id, entity.entityType, entity.data as Record<string, unknown>);
    } catch (err) {
      logger.error({ err, entityId: entity.id }, 'Failed to create node in Neo4j');
    }

    // Audit
    await this.auditService.log({
      userId,
      action: 'ENTITY_CREATED',
      entityType: entity.entityType,
      entityId: entity.id,
      details: { entityType: entity.entityType },
    });

    return entity;
  }

  async update(id: string, input: UpdateEntityInput, userId?: string): Promise<Entity> {
    const entity = await this.prisma.entity.update({
      where: { id },
      data: {
        ...(input.data !== undefined && { data: input.data }),
        ...(input.confidence !== undefined && { confidence: input.confidence }),
        ...(input.admiraltySource !== undefined && { admiraltySource: input.admiraltySource }),
        ...(input.admiraltyCredibility !== undefined && { admiraltyCredibility: input.admiraltyCredibility }),
        ...(input.tlpLevel !== undefined && { tlpLevel: input.tlpLevel as TLPLevel }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.sources !== undefined && { sources: input.sources }),
      },
    });

    // Sync to Elasticsearch
    try {
      await this.searchService.indexEntity(entity);
    } catch (err) {
      logger.error({ err, entityId: entity.id }, 'Failed to update entity in Elasticsearch');
    }

    // Update Neo4j node properties
    try {
      await this.graphService.updateNodeProperties(entity.id, entity.data as Record<string, unknown>);
    } catch (err) {
      logger.error({ err, entityId: entity.id }, 'Failed to update node in Neo4j');
    }

    await this.auditService.log({
      userId,
      action: 'ENTITY_UPDATED',
      entityType: entity.entityType,
      entityId: entity.id,
      details: { updatedFields: Object.keys(input) },
    });

    return entity;
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    const entity = await this.prisma.entity.findUnique({ where: { id } });
    if (!entity) return false;

    // Delete from all stores
    await this.prisma.entity.delete({ where: { id } });

    try {
      await this.searchService.deleteEntity(id);
    } catch (err) {
      logger.error({ err, entityId: id }, 'Failed to delete entity from Elasticsearch');
    }

    try {
      await this.graphService.deleteNode(id);
    } catch (err) {
      logger.error({ err, entityId: id }, 'Failed to delete node from Neo4j');
    }

    await this.auditService.log({
      userId,
      action: 'ENTITY_DELETED',
      entityType: entity.entityType,
      entityId: id,
    });

    return true;
  }

  async findById(id: string): Promise<Entity | null> {
    return this.prisma.entity.findUnique({ where: { id } });
  }

  async findMany(filters: {
    entityType?: string;
    tags?: string[];
    tlpLevel?: string;
    first?: number;
    after?: string;
  }): Promise<{ entities: Entity[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.tlpLevel) where.tlpLevel = filters.tlpLevel;
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    const take = (filters.first ?? 25) + 1;
    const cursor = filters.after ? { id: filters.after } : undefined;
    const skip = cursor ? 1 : 0;

    const [entities, total] = await Promise.all([
      this.prisma.entity.findMany({
        where,
        take,
        skip,
        cursor,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.entity.count({ where }),
    ]);

    return { entities, total };
  }

  async mergeEntities(
    sourceId: string,
    targetId: string,
    userId?: string,
  ): Promise<Entity> {
    const [source, target] = await Promise.all([
      this.prisma.entity.findUnique({ where: { id: sourceId } }),
      this.prisma.entity.findUnique({ where: { id: targetId } }),
    ]);

    if (!source || !target) {
      throw new Error('Source or target entity not found');
    }

    if (source.entityType !== target.entityType) {
      throw new Error('Cannot merge entities of different types');
    }

    // Merge data: target wins on conflicts
    const mergedData = {
      ...(source.data as Record<string, unknown>),
      ...(target.data as Record<string, unknown>),
    };

    // Merge tags (deduplicate)
    const mergedTags = [...new Set([...source.tags, ...target.tags])];

    // Merge sources
    const sourceSources = Array.isArray(source.sources) ? source.sources : [];
    const targetSources = Array.isArray(target.sources) ? target.sources : [];
    const mergedSources = [...sourceSources, ...targetSources];

    // Use higher confidence
    const mergedConfidence = Math.max(source.confidence, target.confidence);

    // Update target entity
    const merged = await this.prisma.entity.update({
      where: { id: targetId },
      data: {
        data: mergedData,
        tags: mergedTags,
        sources: mergedSources,
        confidence: mergedConfidence,
      },
    });

    // Move all relationships from source to target
    await this.prisma.relationship.updateMany({
      where: { sourceEntityId: sourceId },
      data: { sourceEntityId: targetId },
    });
    await this.prisma.relationship.updateMany({
      where: { targetEntityId: sourceId },
      data: { targetEntityId: targetId },
    });

    // Move case associations
    const sourceCaseEntities = await this.prisma.caseEntity.findMany({
      where: { entityId: sourceId },
    });
    for (const ce of sourceCaseEntities) {
      const exists = await this.prisma.caseEntity.findUnique({
        where: { caseId_entityId: { caseId: ce.caseId, entityId: targetId } },
      });
      if (!exists) {
        await this.prisma.caseEntity.create({
          data: { caseId: ce.caseId, entityId: targetId },
        });
      }
    }

    // Move notes
    await this.prisma.note.updateMany({
      where: { entityId: sourceId },
      data: { entityId: targetId },
    });

    // Delete source entity (cascades case_entities)
    await this.delete(sourceId, userId);

    // Sync merged entity
    try {
      await this.searchService.indexEntity(merged);
    } catch (err) {
      logger.error({ err, entityId: merged.id }, 'Failed to reindex merged entity');
    }

    try {
      await this.graphService.mergeNodes(sourceId, targetId);
    } catch (err) {
      logger.error({ err }, 'Failed to merge nodes in Neo4j');
    }

    await this.auditService.log({
      userId,
      action: 'ENTITY_MERGED',
      entityType: merged.entityType,
      entityId: targetId,
      details: { sourceId, targetId },
    });

    return merged;
  }

  async findDuplicates(entityId: string, threshold: number = 0.7): Promise<Entity[]> {
    const entity = await this.prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) return [];

    // Use Elasticsearch more-like-this for fuzzy matching
    try {
      const results = await this.searchService.findSimilar(entityId, entity.entityType, threshold);
      const ids = results.map((r) => r.id).filter((id) => id !== entityId);

      if (ids.length === 0) return [];

      return this.prisma.entity.findMany({
        where: { id: { in: ids } },
      });
    } catch (err) {
      logger.error({ err, entityId }, 'Failed to find duplicates via Elasticsearch');

      // Fallback: simple tag overlap matching
      if (entity.tags.length > 0) {
        return this.prisma.entity.findMany({
          where: {
            id: { not: entityId },
            entityType: entity.entityType,
            tags: { hasSome: entity.tags },
          },
          take: 10,
        });
      }
      return [];
    }
  }

  async bulkCreate(inputs: CreateEntityInput[], userId?: string): Promise<Entity[]> {
    const entities: Entity[] = [];

    for (const input of inputs) {
      const entity = await this.create(input, userId);
      entities.push(entity);
    }

    return entities;
  }
}
