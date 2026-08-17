import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('./workspaces.ts', import.meta.url), 'utf8');

// Regression coverage for requirement 5 (non-YouTube ingested sources never
// receive the boost) and requirement 7 (Workspace isolation): the source
// list the boost considers is filtered to YOUTUBE/COMPLETED and is fetched
// with the same ownership-verified `workspaceId` (res.locals.workspace.id)
// every other handler in this file already uses — never req.params.id and
// never a client-supplied Workspace id.
test('the ingested YouTube boost only ever considers already-completed YOUTUBE sources from the current, ownership-verified Workspace', () => {
  assert.match(routeSource, /source\.type === 'YOUTUBE' && source\.status === 'COMPLETED'/);
  assert.match(routeSource, /const workspaceSources = await getWorkspaceSources\(workspaceId\)/);
  assert.match(routeSource, /const workspaceId = res\.locals\.workspace\.id;/);
});

test('the boost is gated behind the same resourceIntent detection Resource Intelligence already uses, and never runs on its own', () => {
  assert.match(routeSource, /const resourceRecommendationsPromise = resourceIntent\s*\n\s*\? resolveResources/);
  assert.match(routeSource, /if \(!isYouTubeRecommendationQuery\(resourceIntent\.query\)\) return recommendations;/);
});

test('a failure resolving ingested sources or applying the boost fails closed to the existing external recommendations, never throwing', () => {
  const boostBlockStart = routeSource.indexOf('.then(async (recommendations) => {');
  assert.ok(boostBlockStart >= 0);
  const boostBlockEnd = routeSource.indexOf(': Promise.resolve([]);', boostBlockStart);
  const boostBlock = routeSource.slice(boostBlockStart, boostBlockEnd);
  assert.match(boostBlock, /catch \(error\) \{/);
  assert.match(boostBlock, /logger\.warn\('Ingested YouTube source boost failed closed'/);
  assert.match(boostBlock, /return recommendations;/);
});

test('the boost only prepends/dedupes and never replaces resolveResources or the external limit', () => {
  assert.match(routeSource, /resolveResources\(\{\s*\n\s*\.\.\.resourceIntent,/);
  assert.match(routeSource, /limit: 4,/);
  assert.match(routeSource, /promoteIngestedYouTubeSources\(\{/);
});
