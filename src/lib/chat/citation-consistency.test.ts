import assert from 'node:assert/strict';
import test from 'node:test';
import { RAGCitation } from '../retrieval/rag-service';
import { CitationSafeStream, citationsUsedByResponse } from './citation-consistency';

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
