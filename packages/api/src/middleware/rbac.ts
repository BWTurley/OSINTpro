import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import type { AuthenticatedRequest } from './auth.js';

const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.ADMIN]: 100,
  [Role.ANALYST]: 50,
  [Role.API_USER]: 30,
  [Role.VIEWER]: 10,
};

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function requireMinimumRole(minimumRole: Role) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.user.role];
    const requiredLevel = ROLE_HIERARCHY[minimumRole];

    if (userLevel < requiredLevel) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

// GraphQL context helper -- throws instead of sending HTTP responses
export function assertRole(userRole: Role | undefined, requiredRoles: Role[]): void {
  if (!userRole) {
    throw new Error('Authentication required');
  }
  if (!requiredRoles.includes(userRole)) {
    throw new Error('Insufficient permissions');
  }
}

export function assertMinimumRole(userRole: Role | undefined, minimumRole: Role): void {
  if (!userRole) {
    throw new Error('Authentication required');
  }
  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[minimumRole];
  if (userLevel < requiredLevel) {
    throw new Error('Insufficient permissions');
  }
}
