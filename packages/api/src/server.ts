import express from 'express';
import http from 'http';
import helmet from 'helmet';
import passport from 'passport';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import depthLimit from 'graphql-depth-limit';
import { doubleCsrf } from 'csrf-csrf';
import { PrismaClient } from '@prisma/client';

import { config } from './config.js';
import { logger } from './utils/logger.js';
import { typeDefs, resolvers } from './schema/index.js';

import { AuthService } from './services/authService.js';
import { AuditService } from './services/auditService.js';
import { EntityService } from './services/entityService.js';
import { SearchService } from './services/searchService.js';
import { GraphService } from './services/graphService.js';
import { CollectionService } from './services/collectionService.js';
import { ExportService } from './services/exportService.js';
import { StorageService } from './services/storageService.js';

import { createAuthMiddleware, AuthenticatedRequest } from './middleware/auth.js';
import { createAuditMiddleware } from './middleware/audit.js';
import { createRateLimiter, closeRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createEntityLoader } from './resolvers/entityResolvers.js';

import { createAuthRouter } from './routes/auth.js';
import { createFileRouter } from './routes/files.js';
import { createExportRouter } from './routes/export.js';
import { createHealthRouter } from './routes/health.js';
import { createAuditRouter } from './routes/audit.js';

async function main() {
  // Initialize clients
  const prisma = new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

  const searchService = new SearchService();
  const graphService = new GraphService();
  const storageService = new StorageService();
  const auditService = new AuditService(prisma);
  const authService = new AuthService(prisma);
  const entityService = new EntityService(prisma, searchService, graphService, auditService);
  const collectionService = new CollectionService(prisma);
  const exportService = new ExportService(prisma);

  // Connect to PostgreSQL
  await prisma.$connect();
  logger.info('Connected to PostgreSQL');

  // Initialize services (best-effort -- server starts even if some fail)
  await Promise.allSettled([
    searchService.initialize(),
    storageService.initialize(),
    auditService.initialize(),
  ]);

  // Setup Passport
  authService.setupPassport();

  // Build executable schema
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Create Express app and HTTP server
  const app = express();
  const httpServer = http.createServer(app);

  // WebSocket server for GraphQL subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const wsCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        // Extract auth from connection params
        const token = (ctx.connectionParams?.authorization as string)?.replace('Bearer ', '');
        let user = undefined;

        if (token) {
          try {
            const payload = authService.verifyAccessToken(token);
            user = { id: payload.sub, email: payload.email, role: payload.role };
          } catch {
            // Invalid token -- proceed unauthenticated
          }
        }

        return {
          user,
          prisma,
          entityService,
          searchService,
          graphService,
          collectionService,
          auditService,
          entityLoader: createEntityLoader(prisma),
        };
      },
    },
    wsServer,
  );

  // Create Apollo Server
  const apollo = new ApolloServer({
    schema,
    validationRules: [depthLimit(10)],
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsCleanup.dispose();
            },
          };
        },
      },
    ],
    formatError: (formattedError) => {
      logger.error({ error: formattedError }, 'GraphQL error');
      // Hide internal errors in production
      if (config.NODE_ENV === 'production' && !formattedError.extensions?.code) {
        return { ...formattedError, message: 'Internal server error' };
      }
      return formattedError;
    },
  });

  await apollo.start();

  // Middleware chain
  app.use(
    helmet({
      contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use((req, res, next) => {
    const allowedOrigins = config.CORS_ORIGIN.split(',').map((s) => s.trim());
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(passport.initialize());
  app.use(createAuthMiddleware(authService));
  app.use(createAuditMiddleware(auditService));

  // CSRF protection for REST API routes (not GraphQL — it uses Bearer tokens)
  const { generateToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => config.JWT_SECRET,
    cookieName: '__csrf',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      path: '/',
    },
    getTokenFromRequest: (req) =>
      (req.headers['x-csrf-token'] as string) ?? '',
  });

  app.get('/api/csrf-token', (req, res) => {
    const token = generateToken(req, res);
    res.json({ csrfToken: token });
  });

  // REST routes (no rate limiting on health)
  app.use('/health', createHealthRouter(prisma, searchService, graphService, storageService));

  // Rate limiter on API routes
  const apiLimiter = createRateLimiter();
  app.use('/auth', apiLimiter, doubleCsrfProtection, createAuthRouter(authService, auditService));
  app.use('/files', apiLimiter, doubleCsrfProtection, createFileRouter(storageService));
  app.use('/export', apiLimiter, doubleCsrfProtection, createExportRouter(exportService));
  app.use('/audit', apiLimiter, doubleCsrfProtection, createAuditRouter(auditService));

  // GraphQL endpoint
  app.use(
    '/graphql',
    apiLimiter,
    expressMiddleware(apollo, {
      context: async ({ req }) => {
        const authReq = req as AuthenticatedRequest;
        return {
          user: authReq.user
            ? { id: authReq.user.id, email: authReq.user.email, role: authReq.user.role }
            : undefined,
          prisma,
          entityService,
          searchService,
          graphService,
          collectionService,
          auditService,
          entityLoader: createEntityLoader(prisma),
        };
      },
    }),
  );

  // Catch-all
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Start server
  httpServer.listen(config.PORT, config.HOST, () => {
    logger.info(
      { port: config.PORT, host: config.HOST, env: config.NODE_ENV },
      'OSINT API server started',
    );
    logger.info('GraphQL endpoint: http://%s:%d/graphql', config.HOST, config.PORT);
    logger.info('Health check: http://%s:%d/health', config.HOST, config.PORT);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    await Promise.allSettled([
      apollo.stop(),
      prisma.$disconnect(),
      graphService.close(),
      collectionService.close(),
      closeRateLimiter(),
    ]);

    logger.info('All connections closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
