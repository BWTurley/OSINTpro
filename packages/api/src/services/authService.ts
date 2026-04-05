import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Redis as IORedis } from 'ioredis';
import { PrismaClient, Role, User } from '@prisma/client';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const SALT_ROUNDS = 12;

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export class AuthService {
  private redis: IORedis;

  constructor(private prisma: PrismaClient) {
    this.redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
    this.redis.on('error', (err) => {
      logger.error({ err }, 'AuthService Redis connection error');
    });
  }

  async revokeToken(token: string): Promise<void> {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) return;
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(`blacklist:${token}`, '1', 'EX', ttl);
    }
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${token}`);
    return result !== null;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions,
    );
  }

  generateRefreshToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role, type: 'refresh' },
      config.JWT_REFRESH_SECRET,
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions,
    );
  }

  generateTokens(user: Pick<User, 'id' | 'email' | 'role'>): AuthTokens {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
      expiresIn: config.JWT_EXPIRES_IN,
    };
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
  }

  verifyRefreshToken(token: string): TokenPayload & { type: string } {
    const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload & { type: string };
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return payload;
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const payload = this.verifyRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new Error('User not found');
    }

    return this.generateTokens(user);
  }

  async register(email: string, password: string, name: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('Email already registered');
    }

    const passwordHash = await this.hashPassword(password);

    return this.prisma.user.create({
      data: { email, passwordHash, name, role: Role.ANALYST },
    });
  }

  async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password');
    }

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = this.generateTokens(user);
    return { user, tokens };
  }

  async findOrCreateGoogleUser(profile: {
    id: string;
    emails: Array<{ value: string }>;
    displayName: string;
  }): Promise<User> {
    const email = profile.emails[0]?.value;
    if (!email) {
      throw new Error('No email found in Google profile');
    }

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: profile.displayName,
          role: Role.ANALYST,
        },
      });
      logger.info({ userId: user.id, email }, 'Created user from Google OAuth');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return user;
  }

  async listUsers(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUserRole(userId: string, role: Role): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }

  checkRole(userRole: Role, requiredRoles: Role[]): boolean {
    return requiredRoles.includes(userRole);
  }

  setupPassport(): void {
    // JWT strategy
    passport.use(
      new JwtStrategy(
        {
          jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
          secretOrKey: config.JWT_SECRET,
        },
        async (payload: TokenPayload, done) => {
          try {
            const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
            if (!user) {
              return done(null, false);
            }
            return done(null, user);
          } catch (err) {
            return done(err, false);
          }
        },
      ),
    );

    // Local strategy
    passport.use(
      new LocalStrategy(
        { usernameField: 'email' },
        async (email, password, done) => {
          try {
            const result = await this.login(email, password);
            return done(null, result.user);
          } catch (err) {
            return done(null, false, { message: (err as Error).message });
          }
        },
      ),
    );

    // Google OAuth strategy
    if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
      passport.use(
        new GoogleStrategy(
          {
            clientID: config.GOOGLE_CLIENT_ID,
            clientSecret: config.GOOGLE_CLIENT_SECRET,
            callbackURL: config.GOOGLE_CALLBACK_URL,
            scope: ['profile', 'email'],
          },
          async (_accessToken, _refreshToken, profile, done) => {
            try {
              const user = await this.findOrCreateGoogleUser(profile as {
                id: string;
                emails: Array<{ value: string }>;
                displayName: string;
              });
              return done(null, user);
            } catch (err) {
              return done(err as Error);
            }
          },
        ),
      );
    }

    passport.serializeUser((user, done) => {
      done(null, (user as User).id);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await this.prisma.user.findUnique({ where: { id } });
        done(null, user);
      } catch (err) {
        done(err);
      }
    });
  }
}
