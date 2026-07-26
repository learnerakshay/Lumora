import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aiActionExecutor,
  aiActionRegistry,
  executeAIAction,
} from './actions';
import { AIActionError } from './actions/errors';
import type { AIActionContext } from './actions/types';

function context(
  overrides: Partial<AIActionContext> = {},
): AIActionContext {
  return {
    workspaceId: 'workspace_1',
    userId: 'user_1',
    sources: [
      {
        id: 'source_pdf',
        title: 'Architecture Guide',
        type: 'PDF',
        status: 'COMPLETED',
      },
      {
        id: 'source_web',
        title: 'Release Notes',
        type: 'WEBSITE',
        status: 'COMPLETED',
      },
      {
        id: 'source_pending',
        title: 'Pending Transcript',
        type: 'YOUTUBE',
        status: 'PROCESSING',
      },
    ],
    conversation: [
      { role: 'USER', content: 'What architecture is described?' },
      {
        role: 'ASSISTANT',
        content: 'The guide describes a modular architecture [Citation #1].',
      },
    ],
    ...overrides,
  };
}

test('registers all production AI actions with reusable metadata', () => {
  assert.deepEqual(
    aiActionRegistry.metadata().map(({ id }) => id),
    [
      'summarize',
      'explain',
      'compare',
      'generate_notes',
      'key_takeaways',
    ],
  );
});

test('summarize resolves and scopes a selected completed source', async () => {
  const plan = await executeAIAction(
    {
      actionId: 'summarize',
      input: { target: 'source', sourceId: 'source_pdf' },
    },
    context(),
  );

  assert.equal(plan.target, 'source');
  assert.deepEqual(plan.sourceIds, ['source_pdf']);
  assert.match(plan.retrievalQuery, /Architecture Guide/);
  assert.match(plan.additionalInstructions, /Focus only/);
  assert.equal(plan.allowWithoutWorkspaceContext, false);
});

test('conversation actions use bounded material and can run without retrieval', async () => {
  const plan = await executeAIAction(
    {
      actionId: 'generate_notes',
      input: { target: 'conversation' },
    },
    context(),
  );

  assert.equal(plan.target, 'conversation');
  assert.equal(plan.allowWithoutWorkspaceContext, true);
  assert.match(plan.additionalInstructions, /ACTION CONVERSATION MATERIAL/);
  assert.match(plan.additionalInstructions, /modular architecture/);
});

test('explain supports selected text and beginner-friendly output', async () => {
  const plan = await executeAIAction(
    {
      actionId: 'explain',
      input: {
        target: 'text',
        subject: 'const value = await loadWorkspace();',
        level: 'beginner',
      },
    },
    context(),
  );

  assert.equal(plan.target, 'text');
  assert.equal(plan.allowWithoutWorkspaceContext, true);
  assert.match(plan.additionalInstructions, /plain-language/);
  assert.match(plan.additionalInstructions, /const value/);
});

test('explain scopes retrieval to the explicitly selected source', async () => {
  const plan = await executeAIAction(
    {
      actionId: 'explain',
      input: { target: 'source', sourceId: 'source_pdf' },
    },
    context(),
  );

  assert.deepEqual(plan.sourceIds, ['source_pdf']);
  assert.deepEqual(
    plan.sourceRetrievals?.map(({ sourceId }) => sourceId),
    ['source_pdf'],
  );
  assert.match(plan.sourceRetrievals?.[0].query || '', /Architecture Guide/);
  assert.equal(plan.allowWithoutWorkspaceContext, false);
});

test('compare requires two distinct completed Workspace sources', async () => {
  const plan = await executeAIAction(
    {
      actionId: 'compare',
      input: { sourceIds: ['source_pdf', 'source_web'] },
    },
    context(),
  );
  assert.deepEqual(plan.sourceIds, ['source_pdf', 'source_web']);
  assert.match(plan.modelPrompt, /Architecture Guide/);
  assert.match(plan.modelPrompt, /Release Notes/);
  assert.match(plan.additionalInstructions, /Missing Topics/);
  assert.deepEqual(
    plan.sourceRetrievals?.map(({ sourceId }) => sourceId),
    ['source_pdf', 'source_web'],
  );
  assert.match(plan.sourceRetrievals?.[0].query || '', /Architecture Guide/);
  assert.match(plan.sourceRetrievals?.[1].query || '', /Release Notes/);

  await assert.rejects(
    executeAIAction(
      {
        actionId: 'compare',
        input: { sourceIds: ['source_pdf', 'source_pdf'] },
      },
      context(),
    ),
    (error: unknown) =>
      error instanceof AIActionError &&
      error.code === 'UNSUPPORTED_COMPARISON',
  );
  await assert.rejects(
    executeAIAction(
      {
        actionId: 'compare',
        input: { sourceIds: ['source_pdf', 'source_pending'] },
      },
      context(),
    ),
    (error: unknown) =>
      error instanceof AIActionError &&
      error.code === 'ACTION_SOURCE_NOT_READY',
  );
});

test('empty or invalid action contexts fail with meaningful errors', async () => {
  await assert.rejects(
    executeAIAction(
      { actionId: 'key_takeaways', input: { target: 'workspace' } },
      context({ sources: [] }),
    ),
    (error: unknown) =>
      error instanceof AIActionError &&
      error.code === 'ACTION_CONTEXT_MISSING',
  );
  await assert.rejects(
    aiActionExecutor.execute(
      { actionId: 'unknown' as any },
      context(),
    ),
    (error: unknown) =>
      error instanceof AIActionError && error.code === 'ACTION_NOT_FOUND',
  );
});
