import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  applyFileSelected,
  applyTextChanged,
  blankUploadAttempt,
  buildStartOverState,
} from './skill-intelligence-interactions';

const pageSource = readFileSync(new URL('../../pages/SkillIntelligencePage.tsx', import.meta.url), 'utf8');
const reanalyzeHandler = pageSource.slice(
  pageSource.indexOf('const handleReanalyze = async'),
  pageSource.indexOf('const handleStartOver = async'),
);
const startOverHandler = pageSource.slice(pageSource.indexOf('const handleStartOver = async'));

const fakeFile = { name: 'resume.pdf' } as File;

test('selecting a file clears pasted text and any stale error or usage-limit notice from a prior attempt', () => {
  const withStaleError = {
    resumeText: '',
    selectedFile: null,
    submitError: 'We could not read your last resume.',
    usageLimit: { actionType: 'SKILL_INTELLIGENCE', plan: 'FREE', used: 2, limit: 2, remaining: 0, nextAvailableAt: null } as any,
  };
  const next = applyFileSelected(withStaleError, fakeFile);
  assert.equal(next.selectedFile, fakeFile);
  assert.equal(next.resumeText, '');
  assert.equal(next.submitError, null);
  assert.equal(next.usageLimit, null);
});

test('removing a file (selecting null) also clears stale errors', () => {
  const withFileAndError = {
    resumeText: '',
    selectedFile: fakeFile,
    submitError: 'stale error',
    usageLimit: null,
  };
  const next = applyFileSelected(withFileAndError, null);
  assert.equal(next.selectedFile, null);
  assert.equal(next.submitError, null);
});

test('typing non-empty text deselects any chosen file and clears stale errors', () => {
  const withFileAndError = {
    resumeText: '',
    selectedFile: fakeFile,
    submitError: 'stale error',
    usageLimit: null,
  };
  const next = applyTextChanged(withFileAndError, 'Jane Doe, Software Engineer...');
  assert.equal(next.selectedFile, null);
  assert.equal(next.resumeText, 'Jane Doe, Software Engineer...');
  assert.equal(next.submitError, null);
});

test('clearing the textarea back to empty does not resurrect a previously selected file', () => {
  const afterTyping = applyTextChanged({ resumeText: 'x', selectedFile: null, submitError: null, usageLimit: null }, '');
  assert.equal(afterTyping.selectedFile, null);
  assert.equal(afterTyping.resumeText, '');
});

test('blankUploadAttempt is a fully empty attempt with no error state', () => {
  assert.deepEqual(blankUploadAttempt(), {
    resumeText: '',
    selectedFile: null,
    submitError: null,
    usageLimit: null,
  });
});

test('Start over clears the view, the report, both error channels, and the entire upload attempt', () => {
  const reset = buildStartOverState();
  assert.equal(reset.view, 'empty');
  assert.equal(reset.profileState, null);
  assert.equal(reset.loadError, null);
  assert.equal(reset.reanalyzeError, null);
  assert.deepEqual(reset.upload, blankUploadAttempt());
});

// Regression for "Re-run analysis returns to the upload screen / behaves
// like reset": the handler must never touch view, the upload attempt, or
// null out the report — it only replaces the report with the freshly
// recomputed one and reports its own, separate error.
test('handleReanalyze never navigates away from the results view or touches the upload attempt', () => {
  assert.doesNotMatch(reanalyzeHandler, /setView\(/);
  assert.doesNotMatch(reanalyzeHandler, /setUpload\(/);
  assert.doesNotMatch(reanalyzeHandler, /setProfileState\(null\)/);
  assert.match(reanalyzeHandler, /API_PATHS\.skills\}\/analysis/);
  assert.match(reanalyzeHandler, /setReanalyzeError\(/);
});

// Regression for "Start over does not work correctly": the handler must
// apply the full reset contract, not just clear the report.
test('handleStartOver applies the full reset contract from buildStartOverState', () => {
  assert.match(startOverHandler, /API_PATHS\.skills\}\/profile.*method: 'DELETE'/);
  assert.match(startOverHandler, /buildStartOverState\(\)/);
  assert.match(startOverHandler, /setView\(reset\.view\)/);
  assert.match(startOverHandler, /setUpload\(reset\.upload\)/);
});

// Regression for "loading disables duplicate submission": the Analyze
// button submit must be gated the same way the rest of the app gates
// submissions, not by an ad-hoc local check.
test('handleSubmit uses the shared submission gate to block duplicate analyze requests', () => {
  assert.match(pageSource, /tryBeginSubmission\(submissionGate\.current\)/);
  assert.match(pageSource, /releaseSubmission\(submissionGate\.current\)/);
});

// Regression for "Re-run analysis" failing with "The request took too
// long": POST /analysis re-extracts from the stored resume text through the
// exact same runExtraction() the initial upload uses (up to two provider
// calls, each with its own 60s ceiling in extraction-provider.ts), so the
// server itself allows up to ~120s as a legitimate, non-hung duration for
// this call. REANALYZE_TIMEOUT_MS was previously 20_000 — six times shorter
// than the identical extraction step gets under ANALYZE_TIMEOUT_MS — so a
// perfectly healthy re-run was routinely aborted client-side while the
// server kept working (and still committed usage) after the client had
// already shown a failure. The client ceiling must be a safe superset of the
// server's own worst case, not an independently shorter, unrelated number.
test('the re-run client timeout is not shorter than the extraction step it wraps can legitimately take', () => {
  const providerSource = readFileSync(
    new URL('../../lib/skills/extraction-provider.ts', import.meta.url),
    'utf8',
  );
  const extractionTimeoutMatch = providerSource.match(/EXTRACTION_TIMEOUT_MS\s*=\s*(\d+)/);
  const maxAttemptsMatch = providerSource.match(/MAX_ATTEMPTS\s*=\s*(\d+)/);
  assert.ok(extractionTimeoutMatch, 'expected to find EXTRACTION_TIMEOUT_MS in extraction-provider.ts');
  assert.ok(maxAttemptsMatch, 'expected to find MAX_ATTEMPTS in extraction-provider.ts');
  const serverWorstCaseMs = Number(extractionTimeoutMatch![1]) * Number(maxAttemptsMatch![1]);

  const analyzeTimeoutMatch = pageSource.match(/ANALYZE_TIMEOUT_MS\s*=\s*(\d+)/);
  const reanalyzeTimeoutMatch = pageSource.match(/REANALYZE_TIMEOUT_MS\s*=\s*(\d+)/);
  assert.ok(analyzeTimeoutMatch, 'expected to find ANALYZE_TIMEOUT_MS in SkillIntelligencePage.tsx');
  assert.ok(reanalyzeTimeoutMatch, 'expected to find REANALYZE_TIMEOUT_MS in SkillIntelligencePage.tsx');
  const reanalyzeTimeoutMs = Number(reanalyzeTimeoutMatch![1]);

  assert.ok(
    reanalyzeTimeoutMs >= serverWorstCaseMs,
    `REANALYZE_TIMEOUT_MS (${reanalyzeTimeoutMs}) must be >= the extraction step's own worst case (${serverWorstCaseMs})`,
  );
  // Re-run shares the identical extraction bottleneck with the initial
  // upload's ANALYZE_TIMEOUT_MS (upload additionally parses a PDF/image on
  // top, so it is never appropriate for re-run's ceiling to exceed it).
  assert.equal(reanalyzeTimeoutMs, Number(analyzeTimeoutMatch![1]));
});
