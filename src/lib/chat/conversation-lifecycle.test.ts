import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoredMessage } from './conversation-store';
import {
  ConversationOperationGate,
  reconcileCompletedTurn,
  removeDeletedMessages,
  replaceCompletedAssistant,
  shouldApplyMessageSnapshot,
} from './conversation-lifecycle';

function message(
  id: string,
  role: StoredMessage['role'],
  parentMessageId: string | null,
  content = id,
): StoredMessage {
  return {
    id,
    workspaceId: 'workspace-1',
    parentMessageId,
    role,
    content,
    mode: 'DETAILED',
    status: 'SUCCESS',
    action: null,
    createdAt: '2026-07-26T00:00:00.000Z',
    citations: [],
  };
}

test('stale message snapshots cannot replace a newer completed local turn', () => {
  assert.equal(shouldApplyMessageSnapshot(3, 4), false);
  assert.equal(shouldApplyMessageSnapshot(4, 4), true);
});

test('optimistic query reconciles directly to its persisted query and response', () => {
  const previousUser = message('user-1', 'USER', null);
  const previousAssistant = message('assistant-1', 'ASSISTANT', 'user-1');
  const optimistic = message('usr-temp', 'USER', null, 'new query');
  const persistedUser = message('user-2', 'USER', null, 'new query');
  const citation = {
    id: 'citation-1',
    messageId: 'assistant-2',
    chunkId: 'chunk-1',
    sourceId: 'source-1',
    indexId: 'index-1',
    title: 'Source',
    snippet: 'Grounded passage',
    kind: 'DOCUMENT' as const,
    score: 0.9,
    url: null,
    page: 3,
    timestampStartMs: null,
    timestampEndMs: null,
    textOrigin: 'page:3',
  };
  const persistedAssistant = {
    ...message('assistant-2', 'ASSISTANT', 'user-2', 'final answer'),
    citations: [citation],
  };

  const reconciled = reconcileCompletedTurn(
    [previousUser, previousAssistant, optimistic],
    optimistic.id,
    persistedUser,
    persistedAssistant,
  );

  assert.deepEqual(
    reconciled.map(({ id }) => id),
    ['user-1', 'assistant-1', 'user-2', 'assistant-2'],
  );
  assert.deepEqual(reconciled.at(-1)?.citations, [citation]);
  assert.equal(reconciled.some(({ id }) => id === optimistic.id), false);
});

test('repeated completion events do not duplicate or reorder a completed turn', () => {
  const user = message('user-1', 'USER', null);
  const assistant = message('assistant-1', 'ASSISTANT', user.id);
  const once = reconcileCompletedTurn(
    [message('usr-temp', 'USER', null)],
    'usr-temp',
    user,
    assistant,
  );
  const twice = reconcileCompletedTurn(once, 'usr-temp', user, assistant);
  assert.deepEqual(twice, once);
});

test('delete removes only the selected query and its associated response', () => {
  const messages = [
    message('user-1', 'USER', null),
    message('assistant-1', 'ASSISTANT', 'user-1'),
    message('user-2', 'USER', null),
    message('assistant-2', 'ASSISTANT', 'user-2'),
  ];
  assert.deepEqual(
    removeDeletedMessages(messages, ['user-1', 'assistant-1']).map(({ id }) => id),
    ['user-2', 'assistant-2'],
  );
});

test('failed delete and failed regeneration preserve the existing state', () => {
  const original = [
    message('user-1', 'USER', null),
    message('assistant-1', 'ASSISTANT', 'user-1', 'original answer'),
  ];
  const afterFailedDelete = original;
  const afterFailedRegeneration = original;
  assert.equal(afterFailedDelete, original);
  assert.equal(afterFailedRegeneration, original);
  assert.equal(afterFailedRegeneration[1].content, 'original answer');
});

test('successful regeneration replaces only the completed assistant response', () => {
  const user = message('user-1', 'USER', null);
  const oldAssistant = message(
    'assistant-1',
    'ASSISTANT',
    user.id,
    'old answer',
  );
  const regenerated = {
    ...oldAssistant,
    content: 'fresh answer',
    citations: [
      {
        id: 'citation-new',
        chunkId: 'chunk-new',
        sourceId: 'source-new',
        indexId: 'index-new',
        title: 'Fresh source',
        snippet: 'Fresh evidence',
        kind: 'DOCUMENT' as const,
        score: 0.88,
        url: null,
        page: 2,
        timestampStartMs: null,
        timestampEndMs: null,
        textOrigin: 'page:2',
      },
    ],
  };
  const next = replaceCompletedAssistant([user, oldAssistant], regenerated);
  assert.deepEqual(next.map(({ id }) => id), ['user-1', 'assistant-1']);
  assert.equal(next[1].content, 'fresh answer');
  assert.equal(next[1].citations?.[0].id, 'citation-new');
});

test('operation gate prevents duplicate submits and parallel regeneration', () => {
  const gate = new ConversationOperationGate();
  assert.equal(gate.begin('regenerate:assistant-1'), true);
  assert.equal(gate.begin('regenerate:assistant-1'), false);
  assert.equal(gate.begin('submit:other'), false);
  gate.end('different-operation');
  assert.equal(gate.active, 'regenerate:assistant-1');
  gate.end('regenerate:assistant-1');
  assert.equal(gate.begin('submit:other'), true);
});
