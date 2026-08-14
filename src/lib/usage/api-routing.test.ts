import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Request, Response } from 'express';
import { apiNotFoundHandler } from '../api-not-found';
import { API_PATHS } from '../api-paths';

test('Usage follows the same same-origin API convention as Workspaces', () => {
  const frontendOrigin = 'https://lumora-eight-navy.vercel.app';
  assert.equal(API_PATHS.workspaces, '/api/workspaces');
  assert.equal(API_PATHS.usage, '/api/usage');
  assert.equal(
    new URL(API_PATHS.usage, frontendOrigin).href,
    `${frontendOrigin}/api/usage`,
  );

  const usageProvider = readFileSync(
    new URL('../../components/usage/UsageProvider.tsx', import.meta.url),
    'utf8',
  );
  const workspaceClient = readFileSync(
    new URL('../workspace-dashboard-data.ts', import.meta.url),
    'utf8',
  );
  assert.match(usageProvider, /fetch\(API_PATHS\.usage/);
  assert.match(workspaceClient, /request\(API_PATHS\.workspaces\)/);
});

test('Vercel proxies API paths to Render before applying the SPA fallback', () => {
  const config = JSON.parse(
    readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'),
  ) as {
    rewrites: Array<{ source: string; destination: string }>;
  };
  const apiRewriteIndex = config.rewrites.findIndex(
    ({ source }) => source === '/api/:path*',
  );
  const spaRewriteIndex = config.rewrites.findIndex(
    ({ destination }) => destination === '/index.html',
  );
  assert.ok(apiRewriteIndex >= 0, 'the production API rewrite must exist');
  assert.ok(
    spaRewriteIndex > apiRewriteIndex,
    'the API rewrite must precede the SPA fallback',
  );
  assert.equal(
    config.rewrites[apiRewriteIndex].destination.replace(':path*', 'usage'),
    'https://lumora-vtwo.onrender.com/api/usage',
  );
});

test('the backend mounts Usage and its JSON API boundary before the SPA', () => {
  const serverSource = readFileSync(
    new URL('../../../server.ts', import.meta.url),
    'utf8',
  );
  const usageMount = serverSource.indexOf(
    'app.use(API_PATHS.usage, usageRouter)',
  );
  const apiBoundary = serverSource.indexOf(
    "app.use('/api', apiNotFoundHandler)",
  );
  const spaFallback = serverSource.indexOf('app.use(express.static(distPath))');
  assert.ok(usageMount >= 0, 'the Usage router must be mounted');
  assert.ok(apiBoundary > usageMount, 'the API boundary must follow API routes');
  assert.ok(spaFallback > apiBoundary, 'the API boundary must precede the SPA');
});

test('an unmatched backend API request returns structured JSON, never HTML', () => {
  let statusCode = 0;
  let payload: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  };

  apiNotFoundHandler(
    {} as Request,
    response as unknown as Response,
    () => undefined,
  );

  assert.equal(statusCode, 404);
  assert.deepEqual(
    (payload as { success: boolean; error: { code: string } }).success,
    false,
  );
  assert.equal(
    (payload as { error: { code: string } }).error.code,
    'API_ROUTE_NOT_FOUND',
  );
});
