import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isWorkspaceMetaQuestion,
  NO_SOURCES_META_RESPONSE,
  selectInitialChatRoute,
  selectResponseModeAfterRetrieval,
} from './grounding-router';

test('A1: zero sources plus a general question selects GENERAL without retrieval', () => {
  assert.deepEqual(
    selectInitialChatRoute({
      sourceCount: 0,
      query: 'Give me a roadmap to become a backend engineer.',
      isAIAction: false,
    }),
    { kind: 'GENERAL_WITHOUT_RETRIEVAL', responseMode: 'GENERAL' },
  );
});

test('B1/B2: zero-source Workspace meta variants are deterministic and honest', () => {
  const variants = [
    'What did I upload?',
    'What are my sources?',
    'Summarize my uploaded documents',
    "What's in this Workspace?",
    'What are my notes about?',
    'Show me the information in my sources',
  ];
  for (const query of variants) {
    assert.equal(isWorkspaceMetaQuestion(query), true, query);
    assert.equal(
      selectInitialChatRoute({ sourceCount: 0, query, isAIAction: false }).kind,
      'DETERMINISTIC_NO_SOURCES',
    );
  }
  assert.match(NO_SOURCES_META_RESPONSE, /currently no sources in this Workspace/i);
});

test('meta detection does not swallow ordinary general questions', () => {
  for (const query of [
    'How does document indexing work?',
    'Summarize the benefits of taking notes',
    'What is a developer workspace in VS Code?',
  ]) {
    assert.equal(isWorkspaceMetaQuestion(query), false, query);
  }
});

test('C1/C2: evidence accepted by the existing retrieval boundary remains GROUNDED', () => {
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: true,
      isAIAction: false,
      isWorkspaceMeta: false,
    }),
    'GROUNDED',
  );
});

test('D1/D2: empty post-threshold evidence becomes GENERAL for ordinary questions', () => {
  for (const query of [
    'Give me a roadmap to become a DevOps engineer.',
    'How should I structure a strength-training plan?',
  ]) {
    assert.equal(isWorkspaceMetaQuestion(query), false);
    assert.equal(
      selectResponseModeAfterRetrieval({
        hasContext: false,
        isAIAction: false,
        isWorkspaceMeta: false,
      }),
      'GENERAL',
    );
  }
});

test('unsupported Workspace-meta questions and context-free AI Actions do not become general chat', () => {
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: false,
      isAIAction: false,
      isWorkspaceMeta: true,
    }),
    'GROUNDED',
  );
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: false,
      isAIAction: true,
      isWorkspaceMeta: false,
    }),
    null,
  );
});
