import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import IORedis from 'ioredis';
import { AuthService } from '../services/authService.js';
import { AuditService } from '../services/auditService.js';
import { loginSchema, registerSchema } from '../utils/validation.js';
import { createAppError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/rbac.js';
import { config } from '../config.js';
import { User } from '@prisma/client';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

export function createAuthRouter(authService: AuthService, auditService: AuditService): Router {
  const router = Router();

  // POST /auth/login
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = loginSchema.parse(req.body);

      // Account lockout check
      const attempts = parseInt(await redis.get(`login-attempts:${input.email}`) ?? '0', 10);
      if (attempts >= 5) {
        res.status(429).json({ error: 'Account temporarily locked. Try again in 15 minutes.' });
        return;
      }

      let user: User;
      let tokens: { accessToken: string; refreshToken: string; expiresIn: string };
      try {
        const result = await authService.login(input.email, input.password);
        user = result.user;
        tokens = result.tokens;
      } catch (loginErr) {
        // Increment failed attempts
        await redis.incr(`login-attempts:${input.email}`);
        await redis.expire(`login-attempts:${input.email}`, 900);
        throw loginErr;
      }

      // Clear failed attempts on success
      await redis.del(`login-attempts:${input.email}`);

      await auditService.log({
        userId: user.id,
        action: 'USER_LOGIN',
        sourceIp: req.ip ?? req.socket.remoteAddress,
        details: { method: 'local' },
      });

      res.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        ...tokens,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      next(createAppError(message, 401, 'AUTH_FAILED'));
    }
  });

  // POST /auth/register
  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = registerSchema.parse(req.body);
      const user = await authService.register(input.email, input.password, input.name);
      const tokens = authService.generateTokens(user);

      await auditService.log({
        userId: user.id,
        action: 'USER_REGISTERED',
        sourceIp: req.ip ?? req.socket.remoteAddress,
      });

      res.status(201).json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        ...tokens,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      const status = message.includes('already registered') ? 409 : 400;
      next(createAppError(message, status, 'REGISTRATION_FAILED'));
    }
  });

  // POST /auth/refresh
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (!refreshToken) {
        throw createAppError('Refresh token required', 400, 'MISSING_TOKEN');
      }

      const tokens = await authService.refreshTokens(refreshToken);
      res.json(tokens);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token refresh failed';
      next(createAppError(message, 401, 'REFRESH_FAILED'));
    }
  });

  // GET /auth/google -- redirect to Google OAuth
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
  );

  // GET /auth/google/callback
  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/auth/login' }),
    async (req: Request, res: Response) => {
      const user = req.user as User;
      const tokens = authService.generateTokens(user);

      await auditService.log({
        userId: user.id,
        action: 'USER_LOGIN',
        sourceIp: req.ip ?? req.socket.remoteAddress,
        details: { method: 'google' },
      });

      // Set tokens as httpOnly cookies and redirect clean
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/',
      });
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth/refresh',
      });
      res.redirect(`${config.FRONTEND_URL}/auth/callback`);
    },
  );

  // POST /auth/logout
  router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await authService.revokeToken(token);
    }
    res.json({ message: 'Logged out' });
  });

  return router;
}
