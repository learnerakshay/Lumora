import 'dotenv/config';
import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { prisma } from './src/lib/prisma';
import { logger } from './src/lib/logger';
import { errorResponse, successResponse } from './src/lib/api-response';
import { workspaceRouter } from './src/routes/workspaces';
import { usageRouter } from './src/routes/usage';
import { getServerEnv } from './src/lib/env';
import { AppError } from './src/lib/errors';
import { assertPgvectorAvailable } from './src/lib/chunk-store';
import { ingestionCoordinator } from './src/lib/ingestion/coordinator';
import { API_PATHS } from './src/lib/api-paths';
import { apiNotFoundHandler } from './src/lib/api-not-found';

async function startServer() {
  const env = getServerEnv();
  const app = express();
  const { PORT, NODE_ENV } = env;

  app.use(
    clerkMiddleware({
      publishableKey: env.VITE_CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    }),
  );
  app.use(express.json({ limit: '3mb' }));

  // Workspace API routes
  app.use(API_PATHS.workspaces, workspaceRouter);
  app.use(API_PATHS.usage, usageRouter);

  // Health check API
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await assertPgvectorAvailable();
    } catch (err) {
      logger.error('Health check database/vector query failed', err);
      const response = errorResponse(
        AppError.serviceUnavailable(
          'Database vector readiness check failed',
          'VECTOR_DATABASE_UNAVAILABLE',
        ),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    return res.status(200).json(
      successResponse({
        status: 'ok',
        database: 'connected',
        vectorDatabase: 'ready',
        authentication: 'configured',
        environment: NODE_ENV,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      }),
    );
  });

  // API requests must never fall through to the SPA document. Besides making
  // missing routes machine-readable, this catches frontend/backend deployment
  // skew instead of presenting index.html as a successful API response.
  app.use('/api', apiNotFoundHandler);

  // Vite middleware for dev / static for prod
  if (NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const stopIngestionRecovery = ingestionCoordinator.startRecoveryLoop({
    staleAfterMs: env.INGESTION_STALE_AFTER_MS,
    intervalMs: env.INGESTION_RECOVERY_INTERVAL_MS,
    maxAutomaticRecoveries: env.INGESTION_MAX_RECOVERY_ATTEMPTS,
  });
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Lumora Foundation Server running on http://0.0.0.0:${PORT} [${NODE_ENV}]`);
  });
  server.on('close', stopIngestionRecovery);
}

startServer().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
