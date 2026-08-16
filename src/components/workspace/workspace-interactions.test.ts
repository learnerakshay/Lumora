import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { StoredCitation } from '../../lib/chat/conversation-store';
import {
  citationEvidenceKey,
  canReprocessSource,
  availableCitations,
  citationsForResponse,
  findCitationEvidence,
  formatCitationTimestamp,
  resolveCitationNavigation,
  releaseSubmission,
  sourceRefreshDisabled,
  tryBeginSubmission,
} from './workspace-interactions';
import type { SourceRecord } from '../../lib/source-store';

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

test('a GROUNDED response followed by GENERAL cannot expose old or attached Workspace evidence', () => {
  const evidence = citation();
  assert.deepEqual(citationsForResponse('GROUNDED', [evidence]), [evidence]);
  assert.deepEqual(citationsForResponse('GENERAL', [evidence]), []);
  assert.deepEqual(citationsForResponse(null, undefined), []);
});

test('starting the next response clears selected RHS Context before stream routing', () => {
  const page = readFileSync(
    new URL('../../pages/WorkspaceDetailPage.tsx', import.meta.url),
    'utf8',
  );
  const submissionStart = page.indexOf('setIsGenerating(true)');
  const streamStart = page.indexOf('const abortController = new AbortController()', submissionStart);
  assert.ok(submissionStart >= 0 && streamStart > submissionStart);
  const submissionReset = page.slice(submissionStart, streamStart);
  assert.match(submissionReset, /setStreamingCitations\(\[\]\)/);
  assert.match(submissionReset, /setStreamingResponseMode\(null\)/);
  assert.match(submissionReset, /setContextCitations\(null\)/);
  assert.match(submissionReset, /setActiveCitationId\(null\)/);
});

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-1',
    workspaceId: 'workspace-1',
    title: 'Guide.pdf',
    type: 'PDF',
    status: 'COMPLETED',
    stage: 'COMPLETED',
    currentVersion: 1,
    url: null,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
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

test('PDF, Website, and Plain Text citations share deterministic navigation', () => {
  assert.deepEqual(
    resolveCitationNavigation(citation(), [source()]),
    {
      kind: 'pdf',
      source: source(),
      href: '/api/workspaces/workspace-1/sources/source-1/content#page=3',
    },
  );
  const website = source({ type: 'WEBSITE', title: 'Research', url: 'https://example.com/research' });
  assert.equal(
    resolveCitationNavigation(citation({ url: 'https://example.com/research' }), [website]).kind,
    'website',
  );
  const text = source({ type: 'TEXT', title: 'Notes' });
  assert.deepEqual(resolveCitationNavigation(citation(), [text]), {
    kind: 'text',
    source: text,
  });
});

test('YouTube citation timestamps resolve to the exact canonical video moment', () => {
  const youtube = source({
    type: 'YOUTUBE',
    title: 'Lecture',
    url: 'https://youtu.be/dQw4w9WgXcQ?si=current',
  });
  assert.deepEqual(
    resolveCitationNavigation(citation({
      page: null,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=persisted',
      timestampStartMs: 141_999,
      timestampEndMs: 145_000,
    }), [youtube]),
    {
      kind: 'youtube',
      source: youtube,
      href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=141s',
    },
  );
  assert.equal(formatCitationTimestamp(20_000), '0:20');
  assert.equal(formatCitationTimestamp(141_000), '2:21');
  assert.equal(formatCitationTimestamp(633_000), '10:33');
  assert.equal(formatCitationTimestamp(3_735_000), '1:02:15');
});

test('deleted sources disappear from active Context while historical citations remain data', () => {
  const historical = citation();
  assert.deepEqual(availableCitations([historical], [source()]), [historical]);
  assert.deepEqual(availableCitations([historical], []), []);
  assert.deepEqual(resolveCitationNavigation(historical, []), { kind: 'unavailable' });
  assert.equal(historical.snippet, 'Supporting evidence.');
});

test('source deletion uses the Lumora modal with no native confirm or alert flow', () => {
  const sidebar = readFileSync(
    new URL('./WorkspaceSourcesSidebar.tsx', import.meta.url),
    'utf8',
  );
  const details = readFileSync(
    new URL('./SourceDetailsModal.tsx', import.meta.url),
    'utf8',
  );
  const modal = readFileSync(
    new URL('./DeleteSourceModal.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(sidebar, /\b(?:window\.)?(?:confirm|alert)\s*\(/);
  assert.doesNotMatch(details, /\b(?:window\.)?(?:confirm|alert)\s*\(/);
  assert.match(modal, /role="alertdialog"/);
  assert.match(modal, /submittingRef\.current/);
  assert.match(modal, /event\.key === 'Escape'/);
  assert.match(modal, /Delete Source/);
});

test('conversation hydration waits for history and chat deletion uses a Lumora confirmation surface', () => {
  const chat = readFileSync(
    new URL('./WorkspaceChatArea.tsx', import.meta.url),
    'utf8',
  );
  const page = readFileSync(
    new URL('../../pages/WorkspaceDetailPage.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(chat, /window\.confirm/);
  assert.match(chat, /loadingHistory/);
  assert.match(chat, /Loading conversation/);
  assert.match(chat, /Delete this conversation turn\?/);
  assert.match(page, /const \[loadingHistory, setLoadingHistory\] = useState\(true\)/);
  assert.match(page, /loadingHistory=\{loadingHistory\}/);
});

test('source deletion submission gate blocks duplicate confirms and permits retry', () => {
  const gate = { current: false };
  assert.equal(tryBeginSubmission(gate), true);
  assert.equal(tryBeginSubmission(gate), false);
  releaseSubmission(gate);
  assert.equal(tryBeginSubmission(gate), true);
});

test('source add and reprocess surfaces use immediate submission gates', () => {
  const addSource = readFileSync(new URL('./AddSourceModal.tsx', import.meta.url), 'utf8');
  const details = readFileSync(new URL('./SourceDetailsModal.tsx', import.meta.url), 'utf8');
  assert.match(addSource, /tryBeginSubmission\(submittingRef\)/);
  assert.match(addSource, /releaseSubmission\(submittingRef\)/);
  assert.match(details, /reprocessingRef\.current/);
});

test('temporary failures permit Retry while permanent failures do not', () => {
  assert.equal(canReprocessSource(source({
    type: 'YOUTUBE',
    status: 'FAILED',
    stage: 'FAILED',
    metadata: { retryable: true, errorCode: 'PROVIDER_TIMEOUT' },
  })), true);
  assert.equal(canReprocessSource(source({
    type: 'YOUTUBE',
    status: 'FAILED',
    stage: 'FAILED',
    metadata: { retryable: false, errorCode: 'NO_SPEECH_DETECTED' },
  })), false);
  assert.equal(canReprocessSource(source({
    type: 'YOUTUBE',
    status: 'PROCESSING',
    stage: 'FETCHING',
  })), false);
});
