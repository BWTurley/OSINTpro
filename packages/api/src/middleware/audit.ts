import { Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService.js';
import type { AuthenticatedRequest } from './auth.js';

export function createAuditMiddleware(auditService: AuditService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Only audit mutating requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const startTime = Date.now();

    // Hook into response finish to log after the request completes
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      auditService.log({
        userId: req.user?.id,
        action: `${req.method} ${req.path}`,
        sourceIp: req.ip ?? req.socket.remoteAddress,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: duration,
          userAgent: req.headers['user-agent'],
        },
      }).catch(() => {
        // Audit logging errors are already handled inside the service
      });
    });

    next();
  };
}
