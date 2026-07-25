import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { prisma } from './src/lib/prisma';
import { logger } from './src/lib/logger';
import { errorResponse, successResponse } from './src/lib/api-response';
import { workspaceRouter } from './src/routes/workspaces';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const NODE_ENV = process.env.NODE_ENV || 'development';

  app.use(express.json());

  // Workspace API routes
  app.use('/api/workspaces', workspaceRouter);

  // Health check API
  app.get('/api/health', async (_req, res) => {
    let dbStatus: 'connected' | 'disconnected' | 'disabled' = 'disconnected';
    let dbConnected = false;

    try {
      if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
        dbConnected = true;
      } else {
        // Local placeholder mode or unconfigured DB
        dbStatus = 'disabled';
        dbConnected = true; // allow health check pass in local unconfigured dev mode
      }
    } catch (err) {
      logger.error('Health check database query failed', err);
      dbStatus = 'disconnected';
      dbConnected = false;
    }

    const response = {
      status: dbConnected ? 'ok' : 'error',
      database: dbStatus,
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };

    if (!dbConnected) {
      return res.status(503).json(errorResponse(new Error('Database connection failed')).payload);
    }

    return res.status(200).json(successResponse(response));
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
