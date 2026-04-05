import { Router, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuditService } from '../services/auditService.js';
import { requireRole } from '../middleware/rbac.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export function createAuditRouter(auditService: AuditService): Router {
  const router = Router();

  // GET /audit/logs -- search audit logs (admin only)
  router.get(
    '/logs',
    requireRole(Role.ADMIN),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const {
          userId,
          action,
          entityType,
          entityId,
          from,
          to,
          page,
          size,
        } = req.query;

        const parsedPage = page ? Math.max(0, parseInt(page as string, 10) || 0) : undefined;
        const parsedSize = size ? Math.min(200, Math.max(1, parseInt(size as string, 10) || 50)) : undefined;
        const fromDate = from ? new Date(from as string) : undefined;
        const toDate = to ? new Date(to as string) : undefined;

        // Reject invalid dates
        if (fromDate && isNaN(fromDate.getTime())) {
          res.status(400).json({ error: 'Invalid "from" date' });
          return;
        }
        if (toDate && isNaN(toDate.getTime())) {
          res.status(400).json({ error: 'Invalid "to" date' });
          return;
        }

        const result = await auditService.search({
          userId: userId as string | undefined,
          action: action as string | undefined,
          entityType: entityType as string | undefined,
          entityId: entityId as string | undefined,
          from: fromDate,
          to: toDate,
          page: parsedPage,
          size: parsedSize,
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /audit/verify -- verify audit chain integrity (admin only)
  router.get(
    '/verify',
    requireRole(Role.ADMIN),
    async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await auditService.verifyChain(500);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
