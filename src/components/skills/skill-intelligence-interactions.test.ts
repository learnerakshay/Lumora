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
