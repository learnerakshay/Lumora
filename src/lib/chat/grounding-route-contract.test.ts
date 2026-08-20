import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(
  new URL('../../routes/workspaces.ts', import.meta.url),
  'utf8',
);
const streamRoute = routeSource.slice(
  routeSource.indexOf("workspaceRouter.post('/:id/chat/stream'"),
);
const conversationStoreSource = readFileSync(
  new URL('./conversation-store.ts', import.meta.url),
  'utf8',
);
const workspacePageSource = readFileSync(
  new URL('../../pages/WorkspaceDetailPage.tsx', import.meta.url),
  'utf8',
);
const evidenceRecoverySource = readFileSync(
  new URL('./evidence-recovery.ts', import.meta.url),
  'utf8',
);

test('normal chat keeps one shared CHAT reservation boundary for both response modes', () => {
  assert.equal((streamRoute.match(/checkAndReserve\(/g) || []).length, 1);
  assert.match(streamRoute, /const meteredActionType = actionPlan \? 'AI_ACTION' : 'CHAT'/);
  assert.match(streamRoute, /await commitUsage\(usageEventId\);/);
  assert.match(streamRoute, /await commitUsage\(usageEventId, providerCompletionMetadata\);/);
  assert.doesNotMatch(streamRoute, /GENERAL_CHAT|GROUNDED_CHAT/);
});

test('zero-source deterministic handling contains no retrieval or provider call', () => {
  const start = streamRoute.indexOf(
    "if (initialChatRoute.kind === 'DETERMINISTIC_NO_SOURCES')",
  );
  const end = streamRoute.indexOf('let retrievedChunks: RetrievedChunk[] = [];', start);
  assert.ok(start >= 0 && end > start);
  const branch = streamRoute.slice(start, end);
  assert.doesNotMatch(branch, /searchWorkspaceChunks|orchestrateGroundedResponse/);
  assert.match(branch, /NO_SOURCES_META_RESPONSE/);
  assert.match(branch, /responseMode: initialChatRoute\.responseMode/);
});

test('Case C keeps the existing retrieval threshold, citation filter, and durable lifecycle', () => {
  assert.match(streamRoute, /topK: 5,\s*threshold: 0\.15/);
  assert.match(streamRoute, /recoverWorkspaceEvidence\(\{/);
  assert.match(streamRoute, /citationsUsedByResponse\(generated\.text, ragContext\.citations\)/);
  assert.match(streamRoute, /CitationSafeStream/);
  assert.match(streamRoute, /replaceWorkspaceAssistantMessage/);
  assert.match(streamRoute, /activeChatGenerations\.register/);
});

test('Case D requires complete evidence coverage before exposing Workspace context or citations', () => {
  assert.match(streamRoute, /evidenceSufficiency = recovery\.assessment/);
  assert.match(
    streamRoute,
    /const hasGroundedContext = responseMode === 'GROUNDED' && ragContext\.hasContext/,
  );
  assert.match(streamRoute, /hasContext: hasGroundedContext/);
  assert.match(
    streamRoute,
    /candidateCitationCount: hasGroundedContext \? ragContext\.citations\.length : 0/,
  );
  assert.match(
    streamRoute,
    /const usedCitations = hasGroundedContext\s*\? citationsUsedByResponse/,
  );
  assert.match(streamRoute, /citations: persistedCitations/);
  assert.match(streamRoute, /hasWorkspaceContext: hasGroundedContext/);
});

test('insufficient topic evidence gets bounded per-topic owned-Workspace recovery searches', () => {
  assert.match(streamRoute, /const recoveryQuery = requestedTopicQuery \|\| followUpTopicQuery/);
  assert.match(evidenceRecoverySource, /MAX_RECOVERY_TOPIC_QUERIES = 6/);
  assert.match(evidenceRecoverySource, /Promise\.all\(/);
  assert.match(
    evidenceRecoverySource,
    /search\(input\.workspaceId, input\.userId, topicQuery, \{\s*topK: RECOVERY_TOP_K_PER_TOPIC,\s*threshold: RECOVERY_SIMILARITY_THRESHOLD/,
  );
  assert.match(evidenceRecoverySource, /MAX_COMBINED_CHUNKS = 10/);
  assert.match(
    evidenceRecoverySource,
    /semanticallyCoveredTopicQueries/,
  );
  assert.equal((streamRoute.match(/checkAndReserve\(/g) || []).length, 1);
});

test('durable assistant success is terminal across post-persistence failures', () => {
  assert.match(streamRoute, /assistantPersisted && persistedAssistantMessage && savedUserMessage/);
  assert.match(streamRoute, /Post-persistence chat finalization failed; preserving durable success/);
  const replaceStart = conversationStoreSource.indexOf(
    'export async function replaceWorkspaceAssistantMessage',
  );
  const replaceEnd = conversationStoreSource.indexOf(
    'export async function deleteWorkspaceQueryTurn',
    replaceStart,
  );
  const replaceFunction = conversationStoreSource.slice(replaceStart, replaceEnd);
  assert.match(replaceFunction, /status: 'SENDING'/);
  assert.match(replaceFunction, /throw new ChatMessageConflictError/);
  assert.match(
    workspacePageSource,
    /data\.type === 'error'[\s\S]*?if \(completedResponse\) continue/,
  );
});

test('auth and Workspace ownership middleware still guard the shared chat route', () => {
  const authIndex = routeSource.indexOf('workspaceRouter.use(requireApiAuth)');
  const ownershipIndex = routeSource.indexOf("workspaceRouter.param('id'");
  const chatIndex = routeSource.indexOf("workspaceRouter.post('/:id/chat/stream'");
  assert.ok(authIndex >= 0 && ownershipIndex > authIndex && chatIndex > ownershipIndex);
  assert.match(streamRoute, /res\.locals\.workspace\.id/);
  assert.match(streamRoute, /res\.locals\.userId/);
});

test('the route uses authenticated source state and has no LLM routing classifier', () => {
  assert.match(
    streamRoute,
    /workspaceSourcesSnapshot = await getWorkspaceSources\(workspaceId\)/,
  );
  assert.equal((streamRoute.match(/selectInitialChatRoute\(/g) || []).length, 1);
});
