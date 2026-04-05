import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { logger } from '../utils/logger.js';
import { User } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function createAuthMiddleware(authService: AuthService) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // Allow unauthenticated requests -- downstream resolvers/routes handle enforcement
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];

    try {
      const payload = authService.verifyAccessToken(token);

      const isRevoked = await authService.isTokenRevoked(token);
      if (isRevoked) {
        return next();
      }

      // Attach a lightweight user object. Full user is loaded by resolvers when needed.
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        name: '',
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      next();
    } catch (err) {
      logger.debug({ err }, 'Invalid JWT token');
      // Don't reject -- let downstream decide if auth is required
      next();
    }
  };
}
