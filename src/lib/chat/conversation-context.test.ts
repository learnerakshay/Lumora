import assert from 'node:assert/strict';
import test from 'node:test';
import { StoredMessage } from './conversation-store';
import { buildConversationHistory } from './conversation-context';

function message(
  id: string,
  role: StoredMessage['role'],
  content: string,
  citations = role === 'ASSISTANT' ? [{ id: `c-${id}` } as any] : undefined,
): StoredMessage {
  return {
    id,
    workspaceId: 'workspace-1',
    role,
    content,
    mode: 'DETAILED',
    status: 'SUCCESS',
    createdAt: new Date().toISOString(),
    citations,
  };
}

test('history contains only complete grounded turns in role order', () => {
  const messages = [
    message('u1', 'USER', 'first'),
    message('a1', 'ASSISTANT', 'grounded answer'),
    message('u2', 'USER', 'dangling'),
    message('current', 'USER', 'current question'),
  ];
  assert.deepEqual(buildConversationHistory(messages, 'current'), [
    { role: 'user', content: 'first' },
    { role: 'assistant', content: 'grounded answer' },
  ]);
});

test('history excludes stale ungrounded answers, duplicate IDs, and oversized turns', () => {
  const messages = [
    message('u1', 'USER', 'old question'),
    message('a1', 'ASSISTANT', 'stale answer', []),
    message('u2', 'USER', 'x'.repeat(100)),
    message('u2', 'USER', 'duplicate'),
    message('a2', 'ASSISTANT', 'y'.repeat(100)),
  ];
  assert.deepEqual(buildConversationHistory(messages, 'current', 10), []);
});
