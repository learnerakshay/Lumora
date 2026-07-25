import 'dotenv/config';
import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { prisma } from './src/lib/prisma';
import { logger } from './src/lib/logger';
import { errorResponse, successResponse } from './src/lib/api-response';
import { workspaceRouter } from './src/routes/workspaces';
import { getServerEnv } from './src/lib/env';
import { AppError } from './src/lib/errors';

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
  app.use(express.json());

  // Workspace API routes
  app.use('/api/workspaces', workspaceRouter);

  // Health check API
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      logger.error('Health check database query failed', err);
      const response = errorResponse(
        AppError.serviceUnavailable('Database readiness check failed', 'DATABASE_UNAVAILABLE'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    return res.status(200).json(
      successResponse({
        status: 'ok',
        database: 'connected',
        authentication: 'configured',
        environment: NODE_ENV,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      }),
    );
  });

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

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Lumora Foundation Server running on http://0.0.0.0:${PORT} [${NODE_ENV}]`);
  });
}

startServer().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
