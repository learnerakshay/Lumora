import assert from 'node:assert/strict';
import test from 'node:test';
import { RAGCitation } from '../retrieval/rag-service';
import {
  assertNoWorkspaceCitationMarkers,
  CitationSafeStream,
  citationsUsedByResponse,
  GeneralResponseSafeStream,
} from './citation-consistency';

function citation(index: number): RAGCitation {
  return {
    id: `citation-${index}`,
    chunkId: `chunk-${index}`,
    sourceId: `source-${index}`,
    indexId: `index-${index}`,
    title: `Source ${index}`,
    snippet: 'Evidence',
    kind: 'DOCUMENT',
    score: 0.9,
    url: null,
    page: index,
    timestampStartMs: null,
    timestampEndMs: null,
    textOrigin: `Page ${index}`,
  };
}

test('returns only cited provenance in first-use order without duplicates', () => {
  const citations = [citation(1), citation(2)];
  assert.deepEqual(
    citationsUsedByResponse('Fact [Citation #2]. Again [Citation #2]. Other [Citation #1].', citations),
    [citations[1], citations[0]],
  );
});

test('every accepted marker resolves only to evidence supplied for that generation', () => {
  const supplied = [citation(1), citation(2)];
  const accepted = citationsUsedByResponse(
    'First fact [Citation #1]. Combined fact [Citation #1] [Citation #2].',
    supplied,
  );
  const suppliedChunkIds = new Set(supplied.map(({ chunkId }) => chunkId));
  assert.ok(accepted.every(({ chunkId }) => suppliedChunkIds.has(chunkId)));
  assert.deepEqual(accepted.map(({ chunkId }) => chunkId), ['chunk-1', 'chunk-2']);
});

test('rejects missing and fabricated citation markers', () => {
  assert.throws(() => citationsUsedByResponse('Unsupported claim.', [citation(1)]));
  assert.throws(() => citationsUsedByResponse('Claim [Citation #3].', [citation(1)]));
  assert.throws(() => citationsUsedByResponse('Claim [Citation #abc].', [citation(1)]));
});

test('stream withholds output until a valid citation and never emits an invalid marker', () => {
  const emitted: string[] = [];
  const stream = new CitationSafeStream([citation(1)], (text) => emitted.push(text));
  stream.push('Grounded fact ');
  assert.deepEqual(emitted, []);
  stream.push('[Citation ');
  assert.deepEqual(emitted, []);
  stream.push('#1]. More');
  assert.equal(emitted.join(''), 'Grounded fact [Citation #1]. More');
  stream.finish('Grounded fact [Citation #1]. More');

  const invalid = new CitationSafeStream([citation(1)], (text) => emitted.push(text));
  assert.throws(() => invalid.push('Bad [Citation #7]'));

  const laterInvalid = new CitationSafeStream([citation(1)], () => undefined);
  laterInvalid.push('Valid [Citation #1]. ');
  assert.throws(() => laterInvalid.push('Bad [Citation #7].'));
});

test('GENERAL streaming passes ordinary text but blocks fabricated Workspace citations', () => {
  const emitted: string[] = [];
  const safe = new GeneralResponseSafeStream((value) => emitted.push(value));
  safe.push('General guidance with no Workspace evidence.');
  safe.finish('General guidance with no Workspace evidence.');
  assert.equal(emitted.join(''), 'General guidance with no Workspace evidence.');

  assert.throws(
    () => assertNoWorkspaceCitationMarkers('Invented claim [Citation #1]'),
    /attempted to reference Workspace citations/i,
  );
  const blocked: string[] = [];
  const splitMarker = new GeneralResponseSafeStream((value) => blocked.push(value));
  splitMarker.push('Safe prefix [Cita');
  assert.deepEqual(blocked, ['Safe prefix ']);
  assert.throws(() => splitMarker.push('tion #1]'), /Workspace citations/i);
});
