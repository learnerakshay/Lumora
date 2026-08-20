import assert from 'node:assert/strict';
import test from 'node:test';
import type { RetrievedChunk } from '../retrieval/rag-service';
import { recoverWorkspaceEvidence } from './evidence-recovery';
import {
  selectInitialChatRoute,
  selectResponseModeAfterRetrieval,
} from './grounding-router';

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  const content =
    overrides.content ||
    'A validated Workspace passage expressed with deliberately different wording.';
  return {
    id: 'chunk-1',
    sourceId: 'source-1',
    workspaceId: 'workspace-1',
    indexId: 'index-1',
    sourceVersion: 1,
    content,
    tokenCount: Math.ceil(content.length / 4),
    chunkIndex: 0,
    similarity: 0.72,
    sourceTitle: 'Modern AI Systems',
    sourceType: 'TEXT',
    sourceUrl: null,
    parserMetadata: null,
    sourceCleanText: content,
    ...overrides,
  };
}

function responseMode(result: Awaited<ReturnType<typeof recoverWorkspaceEvidence>>) {
  return selectResponseModeAfterRetrieval({
    hasContext: result.ragContext.hasContext,
    hasSufficientEvidence: result.assessment.sufficient,
    isAIAction: false,
    isWorkspaceMeta: false,
  });
}

test('empty Workspace stays GENERAL and does not run recovery retrieval', async () => {
  let searchCalls = 0;
  const result = await recoverWorkspaceEvidence(
    {
      workspaceId: 'workspace-1',
      userId: 'user-1',
      retrievalQuery: 'What is RAG?',
      answerabilityQuery: 'rag',
      recoveryQuery: null,
      mode: 'CONCISE',
      initialChunks: [],
    },
    {
      search: async () => {
        searchCalls += 1;
        return [];
      },
    },
  );

  assert.equal(searchCalls, 0);
  assert.equal(result.assessment.sufficient, false);
  assert.equal(responseMode(result), 'GENERAL');
  assert.equal(result.ragContext.citations.length, 0);
});

test('the same RAG and fine-tuning question becomes GROUNDED after semantic topic recovery', async () => {
  const query = 'What is RAG and fine-tuning?';
  assert.deepEqual(
    selectInitialChatRoute({ sourceCount: 0, query, isAIAction: false }),
    { kind: 'GENERAL_WITHOUT_RETRIEVAL', responseMode: 'GENERAL' },
  );

  const ragPdf = chunk({
    id: 'pdf-rag',
    sourceId: 'pdf-source',
    indexId: 'pdf-index',
    sourceTitle: 'Modern AI Systems',
    sourceType: 'PDF',
    content:
      '[Page 1]\nRetrieval-augmented generation supplies a language model with passages recovered from a knowledge index.',
    parserMetadata: { pages: [{ pageNumber: 1 }] },
  });
  const tuningPdf = chunk({
    id: 'pdf-tuning',
    sourceId: 'pdf-source',
    indexId: 'pdf-index',
    chunkIndex: 1,
    sourceTitle: 'Modern AI Systems',
    sourceType: 'PDF',
    content:
      '[Page 2]\nSupervised adaptation updates model weights with curated examples for a specialized task.',
    parserMetadata: { pages: [{ pageNumber: 2 }] },
  });
  const calls: Array<{ query: string; topK: number | undefined; threshold: number | undefined }> = [];
  const search = async (
    _workspaceId: string,
    _userId: string,
    topicQuery: string,
    options: { topK?: number; threshold?: number },
  ) => {
    calls.push({ query: topicQuery, topK: options.topK, threshold: options.threshold });
    if (topicQuery === 'rag') return [ragPdf];
    if (topicQuery === 'fine tuning') return [tuningPdf];
    return [];
  };

  const result = await recoverWorkspaceEvidence(
    {
      workspaceId: 'workspace-1',
      userId: 'user-1',
      retrievalQuery: query,
      answerabilityQuery: 'rag and fine tuning',
      recoveryQuery: 'rag and fine tuning',
      mode: 'DETAILED',
      // Mirrors production: the original semantic search recovered useful
      // passages, but literal token coverage still rejected the paraphrases.
      initialChunks: [ragPdf, tuningPdf],
    },
    { search: search as typeof import('../retrieval/rag-service').searchWorkspaceChunks },
  );

  assert.deepEqual(calls, [
    { query: 'rag', topK: 3, threshold: 0.15 },
    { query: 'fine tuning', topK: 3, threshold: 0.15 },
  ]);
  assert.equal(result.assessment.sufficient, true);
  assert.equal(result.assessment.coveredTopicGroupCount, 2);
  assert.equal(result.diagnostics.semanticallyCoveredTopicGroupCount, 2);
  assert.equal(responseMode(result), 'GROUNDED');
  assert.equal(result.ragContext.citations.length, 2);
  assert.deepEqual(result.ragContext.citations.map(({ page }) => page), [1, 2]);
  assert.ok(result.ragContext.citations.every(({ sourceId }) => sourceId === 'pdf-source'));
});

test('an irrelevant source remains GENERAL when targeted semantic recovery returns no evidence', async () => {
  const reactChunk = chunk({
    content: 'React renders component trees and schedules state-driven user-interface updates.',
    sourceTitle: 'React Guide',
  });
  const result = await recoverWorkspaceEvidence(
    {
      workspaceId: 'workspace-1',
      userId: 'user-1',
      retrievalQuery: 'What is quantum entanglement?',
      answerabilityQuery: 'quantum entanglement',
      recoveryQuery: 'quantum entanglement',
      mode: 'CONCISE',
      initialChunks: [reactChunk],
    },
    { search: async () => [] },
  );

  assert.equal(result.assessment.sufficient, false);
  assert.equal(result.assessment.reason, 'missing_topic_coverage');
  assert.equal(responseMode(result), 'GENERAL');
});

test('partial semantic coverage of a multi-topic request remains GENERAL', async () => {
  const ragChunk = chunk({
    content: 'External passages are recovered and supplied to a model before it produces an answer.',
  });
  const result = await recoverWorkspaceEvidence(
    {
      workspaceId: 'workspace-1',
      userId: 'user-1',
      retrievalQuery: 'What is RAG and fine-tuning?',
      answerabilityQuery: 'rag and fine tuning',
      recoveryQuery: 'rag and fine tuning',
      mode: 'CONCISE',
      initialChunks: [ragChunk],
    },
    {
      search: (async (_workspaceId, _userId, topicQuery) =>
        topicQuery === 'rag' ? [ragChunk] : []) as typeof import('../retrieval/rag-service').searchWorkspaceChunks,
    },
  );

  assert.equal(result.assessment.sufficient, false);
  assert.equal(result.assessment.coveredTopicGroupCount, 1);
  assert.equal(responseMode(result), 'GENERAL');
});

test('YouTube semantic recovery produces GROUNDED timestamp evidence', async () => {
  const videoChunk = chunk({
    id: 'youtube-chunk',
    sourceId: 'youtube-source',
    indexId: 'youtube-index',
    sourceType: 'YOUTUBE',
    sourceTitle: 'Adapting Models from Examples',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    content:
      '[00:00:12.000 - 00:00:26.000] Curated demonstrations update internal parameters so a model specializes on a target task.',
  });
  const result = await recoverWorkspaceEvidence(
    {
      workspaceId: 'workspace-1',
      userId: 'user-1',
      retrievalQuery: 'How do models learn from demonstrations?',
      answerabilityQuery: 'model demonstration',
      recoveryQuery: 'model demonstration',
      mode: 'DETAILED',
      initialChunks: [videoChunk],
    },
    { search: async () => [videoChunk] },
  );

  assert.equal(result.assessment.sufficient, true);
  assert.equal(responseMode(result), 'GROUNDED');
  assert.equal(result.ragContext.citations.length, 1);
  assert.equal(result.ragContext.citations[0].sourceId, 'youtube-source');
  assert.equal(result.ragContext.citations[0].timestampStartMs, 12_000);
  assert.equal(result.ragContext.citations[0].timestampEndMs, 26_000);
});
