import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { AuthService } from '../services/authService.js';
import { AuditService } from '../services/auditService.js';
import { loginSchema, registerSchema } from '../utils/validation.js';
import { createAppError } from '../middleware/errorHandler.js';
import { User } from '@prisma/client';

export function createAuthRouter(authService: AuthService, auditService: AuditService): Router {
  const router = Router();

  // POST /auth/login
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = loginSchema.parse(req.body);
      const { user, tokens } = await authService.login(input.email, input.password);

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

      // Redirect to frontend with tokens as query params
      const redirectUrl = new URL('/auth/callback', 'http://localhost:3000');
      redirectUrl.searchParams.set('accessToken', tokens.accessToken);
      redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);

      res.redirect(redirectUrl.toString());
    },
  );

  return router;
}
