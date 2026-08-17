import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('./learning.ts', import.meta.url), 'utf8');

function sliceHandler(startMarker: string, endMarker?: string): string {
  const start = routeSource.indexOf(startMarker);
  assert.ok(start >= 0, `expected to find "${startMarker}" in learning.ts`);
  if (!endMarker) return routeSource.slice(start);
  const end = routeSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}" in learning.ts`);
  return routeSource.slice(start, end);
}

const postPlanHandler = sliceHandler("learningRouter.post('/plan',", "learningRouter.get('/plan',");
const getPlanHandler = sliceHandler("learningRouter.get('/plan',", "learningRouter.get('/plan/:id',");
const getPlanByIdHandler = sliceHandler("learningRouter.get('/plan/:id',", "learningRouter.post('/plan/:id/workspace',");
const postWorkspaceHandler = sliceHandler("learningRouter.post('/plan/:id/workspace',", "learningRouter.delete('/plan/:id',");
const deletePlanHandler = sliceHandler("learningRouter.delete('/plan/:id',");

test('POST /plan is the only Learning Path route that reserves and commits LEARNING_PATH usage', () => {
  assert.match(postPlanHandler, /checkAndReserve\(userId, 'LEARNING_PATH'\)/);
  assert.match(postPlanHandler, /await commitUsage\(usageEventId/);
  for (const handler of [getPlanHandler, getPlanByIdHandler, postWorkspaceHandler, deletePlanHandler]) {
    assert.doesNotMatch(handler, /checkAndReserve|commitUsage/);
  }
});

test('every failure path in POST /plan discards a live reservation', () => {
  const discardCount = (postPlanHandler.match(/discardUsage\(usageEventId\)/g) || []).length;
  assert.ok(discardCount >= 2, 'expected both the inner build-failure catch and the outer catch to discard usage');
  assert.match(postPlanHandler, /if \(usageEventId\) await discardUsage\(usageEventId\)/);
});

test('POST /plan validates the role and every gap id against the stored analysis before reserving usage', () => {
  const reserveIndex = postPlanHandler.indexOf('checkAndReserve');
  const roleCheckIndex = postPlanHandler.indexOf('LEARNING_ROLE_NOT_IN_ANALYSIS');
  const gapCheckIndex = postPlanHandler.indexOf('LEARNING_GAP_NOT_IN_ANALYSIS');
  assert.ok(roleCheckIndex >= 0 && roleCheckIndex < reserveIndex, 'role validation must happen before reserving usage');
  assert.ok(gapCheckIndex >= 0 && gapCheckIndex < reserveIndex, 'gap validation must happen before reserving usage');
  assert.match(postPlanHandler, /selectableGaps\(analysis\.gaps, roleId, uniqueGapIds\)/);
});

test('the Create Learning Workspace handler never imports ingestion and never reads plan resources', () => {
  assert.doesNotMatch(routeSource, /from ['"][^'"]*lib\/ingestion/);
  assert.doesNotMatch(postWorkspaceHandler, /\.resources\b/);
  assert.doesNotMatch(postWorkspaceHandler, /createSource|processSourcePipeline|coordinator\.dispatch|parseSourceContent/);
  assert.match(postWorkspaceHandler, /createWorkspace\(\{/);
});

test('the Create Learning Workspace handler is idempotent per plan: it reuses an existing linked Workspace', () => {
  assert.match(postWorkspaceHandler, /plan\.workspaceLinks\[0\]/);
  assert.match(postWorkspaceHandler, /created: false/);
  assert.match(postWorkspaceHandler, /created: true/);
});

test('DELETE /plan/:id never reserves or commits usage and resolves ownership from res.locals.userId', () => {
  assert.doesNotMatch(deletePlanHandler, /checkAndReserve|commitUsage|discardUsage/);
  assert.match(deletePlanHandler, /deleteLearningPlanForUser\(req\.params\.id, res\.locals\.userId\)/);
});

test('every plan lookup resolves ownership from res.locals.userId, never a client-supplied user id', () => {
  assert.match(getPlanHandler, /getLatestLearningPlan\(res\.locals\.userId\)/);
  assert.match(getPlanByIdHandler, /getLearningPlanForUser\(req\.params\.id, res\.locals\.userId\)/);
  assert.match(postWorkspaceHandler, /getLearningPlanForUser\(req\.params\.id, userId\)/);
});

test('the router requires authentication before any handler runs', () => {
  const authIndex = routeSource.indexOf('learningRouter.use(requireApiAuth)');
  const firstHandlerIndex = routeSource.indexOf("learningRouter.post('/plan'");
  assert.ok(authIndex >= 0 && authIndex < firstHandlerIndex);
});
