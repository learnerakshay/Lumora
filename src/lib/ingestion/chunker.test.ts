import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanExtractedText } from './cleaner';
import { generateSemanticChunks } from './chunker';

// Mirrors rag-service.ts's inline timestamp regex (findTranscriptRange) — the
// primary path citation derivation uses to recover a YouTube/VTT timestamp.
const INLINE_TIMESTAMP = /\[(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s*(?:-->|-)\s*(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\]/g;

function formatMs(ms: number): string {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = (totalSeconds % 60).toFixed(3).padStart(6, '0');
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds}`;
}

// Approximates parseYouTubeSource's rawText assembly: single-newline-joined
// "[start - end] text" cues, which collapses into one long chunker paragraph.
function transcriptText(cues: Array<{ text: string; offsetMs: number; durationMs: number }>): string {
  return cleanExtractedText(
    cues
      .map((cue) => `[${formatMs(cue.offsetMs)} - ${formatMs(cue.offsetMs + cue.durationMs)}] ${cue.text}`)
      .join('\n'),
  );
}

function markersIn(content: string): Array<[string, string]> {
  INLINE_TIMESTAMP.lastIndex = 0;
  return [...content.matchAll(INLINE_TIMESTAMP)].map((match) => [match[1], match[2]]);
}

test('long single-paragraph transcripts keep every inline timestamp marker intact', () => {
  // Realistic Gemini-style punctuated speech, well within normal speaking pace.
  const cues = Array.from({ length: 40 }, (_, index) => ({
    text: `Segment number ${index} explains concept ${index} in careful detail, covering topic ${index} and why item ${index} matters here.`,
    offsetMs: index * 4_000,
    durationMs: 4_000,
  }));
  const text = transcriptText(cues);
  assert.ok(text.length > 1_600, 'fixture must exceed the chunker long-paragraph threshold');

  const chunks = generateSemanticChunks(text, { targetChunkSize: 1_200, overlapSize: 200 });
  assert.ok(chunks.length > 1);

  const expectedMarkers = markersIn(text);
  assert.equal(expectedMarkers.length, cues.length);

  const survivingMarkers = new Set(
    chunks.flatMap((chunk) => markersIn(chunk.content).map(([start, end]) => `${start}|${end}`)),
  );
  for (const [start, end] of expectedMarkers) {
    assert.ok(
      survivingMarkers.has(`${start}|${end}`),
      `marker [${start} - ${end}] must survive intact in at least one chunk`,
    );
  }
});

test('every chunk of a long transcript carries at least one intact timestamp marker', () => {
  const cues = Array.from({ length: 60 }, (_, index) => ({
    text: `Point ${index}. It builds on the previous idea and adds one more concrete detail worth remembering.`,
    offsetMs: index * 5_000,
    durationMs: 5_000,
  }));
  const chunks = generateSemanticChunks(transcriptText(cues), {
    targetChunkSize: 1_200,
    overlapSize: 200,
  });
  assert.ok(chunks.length > 1);
  for (const [index, chunk] of chunks.entries()) {
    assert.ok(
      markersIn(chunk.content).length > 0,
      `chunk ${index} must retain an intact timestamp marker: ${JSON.stringify(chunk.content.slice(0, 120))}`,
    );
  }
});

test('VTT-style "-->" transcripts keep every inline timestamp marker intact', () => {
  const cues = Array.from({ length: 30 }, (_, index) => ({
    text: `Speaker line ${index} describes the topic with enough words to force chunk boundaries eventually.`,
    offsetMs: index * 6_000,
    durationMs: 6_000,
  }));
  const text = cleanExtractedText(
    cues
      .map((cue) => `[${formatMs(cue.offsetMs)} --> ${formatMs(cue.offsetMs + cue.durationMs)}] ${cue.text}`)
      .join('\n'),
  );
  const chunks = generateSemanticChunks(text, { targetChunkSize: 1_200, overlapSize: 200 });
  const expectedMarkers = markersIn(text);
  const survivingMarkers = new Set(
    chunks.flatMap((chunk) => markersIn(chunk.content).map(([start, end]) => `${start}|${end}`)),
  );
  for (const [start, end] of expectedMarkers) {
    assert.ok(survivingMarkers.has(`${start}|${end}`));
  }
});

test('non-terminal decimal points in ordinary prose are preserved as content, not dropped', () => {
  const filler = 'This paragraph exists only to push the total length past the long-paragraph threshold so the sentence splitter runs. ';
  const text = `${filler.repeat(15)}The release notes mention version 1.2.3 and a benchmark score of 3.14 improved to 3.16, both figures fully readable. ${filler.repeat(15)}`;
  assert.ok(text.length > 1_600);

  const chunks = generateSemanticChunks(text, { targetChunkSize: 1_200, overlapSize: 200 });
  const combined = chunks.map((chunk) => chunk.content).join(' ');
  assert.match(combined, /version 1\.2\.3/);
  assert.match(combined, /3\.14 improved to 3\.16/);
});
