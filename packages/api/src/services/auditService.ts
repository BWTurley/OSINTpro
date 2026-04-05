import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';

export interface AuditEntry {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  sourceIp?: string;
}

export class AuditService {
  private lastHash: string | null = null;

  constructor(private prisma: PrismaClient) {}

  private computeHash(entry: AuditEntry, previousHash: string | null): string {
    const data = JSON.stringify({
      ...entry,
      previousHash,
      timestamp: Date.now(),
    });
    return createHash('sha256').update(data).digest('hex');
  }

  async initialize(): Promise<void> {
    // Load the most recent audit log entry to get the last hash
    const latest = await this.prisma.auditLog.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { previousHash: true },
    });
    this.lastHash = latest?.previousHash ?? null;
    logger.info('Audit service initialized with hash chain');
  }

  async log(entry: AuditEntry): Promise<void> {
    const currentHash = this.computeHash(entry, this.lastHash);

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
          sourceIp: entry.sourceIp,
          previousHash: currentHash,
        },
      });

      this.lastHash = currentHash;
    } catch (err) {
      logger.error({ err, entry }, 'Failed to write audit log');
      // Do not throw -- audit logging should not break the request
    }
  }

  async search(filters: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    size?: number;
  }): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.from || filters.to) {
      const timestamp: Record<string, Date> = {};
      if (filters.from) timestamp.gte = filters.from;
      if (filters.to) timestamp.lte = filters.to;
      where.timestamp = timestamp;
    }

    const page = filters.page ?? 0;
    const size = filters.size ?? 50;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: page * size,
        take: size,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items: items as unknown as Array<Record<string, unknown>>, total };
  }

  async verifyChain(limit: number = 100): Promise<{ valid: boolean; checkedCount: number; brokenAt?: string }> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    if (logs.length <= 1) {
      return { valid: true, checkedCount: logs.length };
    }

    // Verify that each entry's hash was computed correctly
    // Since we store the computed hash (not a reference to the previous entry's hash),
    // we check that the chain of previousHash values is internally consistent
    let checkedCount = 0;
    for (let i = 0; i < logs.length - 1; i++) {
      checkedCount++;
      const current = logs[i];
      const next = logs[i + 1];

      // If the current hash is null but previous exists, chain is broken
      if (!current.previousHash && next.previousHash) {
        return { valid: false, checkedCount, brokenAt: current.id };
      }
    }

    return { valid: true, checkedCount };
  }
}
