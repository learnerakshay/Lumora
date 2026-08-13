import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoredCitation } from '../../lib/chat/conversation-store';
import {
  citationEvidenceKey,
  findCitationEvidence,
  sourceRefreshDisabled,
} from './workspace-interactions';

function citation(overrides: Partial<StoredCitation> = {}): StoredCitation {
  return {
    id: 'citation-1',
    chunkId: 'chunk-1',
    sourceId: 'source-1',
    indexId: 'index-1',
    sourceVersion: 1,
    title: 'Guide.pdf',
    snippet: 'Supporting evidence.',
    url: null,
    page: 3,
    timestampStartMs: null,
    timestampEndMs: null,
    textOrigin: 'PDF',
    ...overrides,
  };
}

test('source refresh is disabled during initial load and manual refresh', () => {
  assert.equal(sourceRefreshDisabled(true, false), true);
  assert.equal(sourceRefreshDisabled(false, true), true);
  assert.equal(sourceRefreshDisabled(false, false), false);
});

test('citation routing resolves the exact Context evidence card by citation ID', () => {
  const selected = citation();
  const evidence = [citation({ id: 'citation-2', chunkId: 'chunk-2' }), selected];
  assert.equal(findCitationEvidence(selected, evidence), selected);
  assert.equal(citationEvidenceKey(selected), 'citation-1');
});

test('citation evidence has a stable provenance fallback when an ID is unavailable', () => {
  const selected = citation({ id: '', page: 7 });
  const match = citation({ id: '', page: 7 });
  assert.equal(findCitationEvidence(selected, [match]), match);
  assert.equal(citationEvidenceKey(selected), 'source-1:chunk-1:7:');
});
