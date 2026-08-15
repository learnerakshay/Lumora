import assert from 'node:assert/strict';
import test from 'node:test';
import {
  historicalCitationInclude,
  normalizeChatResponseMode,
  toStoredCitation,
} from './conversation-store';

test('response-mode hydration preserves new values and keeps historical rows unknown', () => {
  assert.equal(normalizeChatResponseMode('GENERAL'), 'GENERAL');
  assert.equal(normalizeChatResponseMode('GROUNDED'), 'GROUNDED');
  assert.equal(normalizeChatResponseMode(null), null);
  assert.equal(normalizeChatResponseMode('unexpected'), null);
});

function persistedCitation(indexId: string, sourceVersion: number) {
  return toStoredCitation({
    id: `citation-${indexId}`,
    messageId: 'assistant-1',
    chunkId: `chunk-${indexId}`,
    sourceId: 'source-1',
    indexId,
    title: 'Versioned source',
    snippet: `Evidence from version ${sourceVersion}`,
    kind: 'DOCUMENT',
    score: 0.9,
    sourceUrl: null,
    pageNumber: 3,
    timestampStartMs: null,
    timestampEndMs: null,
    textOrigin: 'PDF page 3',
    index: { sourceVersion },
  });
}

test('historical citation hydration preserves its original index and source version', () => {
  const oldCitation = persistedCitation('index-v1', 1);
  assert.equal(oldCitation.indexId, 'index-v1');
  assert.equal(oldCitation.sourceVersion, 1);
  assert.equal(oldCitation.snippet, 'Evidence from version 1');
});

test('historical hydration does not reapply current active-index eligibility', () => {
  assert.deepEqual(historicalCitationInclude, {
    include: { index: { select: { sourceVersion: true } } },
  });
  assert.equal('where' in historicalCitationInclude, false);
});

test('new provenance can use the promoted index without rewriting the old citation', () => {
  const oldCitation = persistedCitation('index-v1', 1);
  const newCitation = persistedCitation('index-v2', 2);

  assert.equal(newCitation.indexId, 'index-v2');
  assert.equal(newCitation.sourceVersion, 2);
  assert.deepEqual(
    { indexId: oldCitation.indexId, sourceVersion: oldCitation.sourceVersion },
    { indexId: 'index-v1', sourceVersion: 1 },
  );
});
