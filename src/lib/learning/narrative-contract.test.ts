import assert from 'node:assert/strict';
import test from 'node:test';
import {
  narratedReadinessSummary,
  narratedTextForStep,
  parseRawNarrative,
  type RawNarrative,
} from './narrative-contract';

const fallback = { whyItMatters: 'fallback why', evidenceBrief: 'fallback brief' };

test('a well-formed narrative payload parses successfully', () => {
  const result = parseRawNarrative({
    readinessSummary: 'You are close.',
    steps: [{ stepId: 'step-1', whyItMatters: 'It matters.', evidenceBrief: 'Build it.' }],
  });
  assert.equal(result.success, true);
});

test('a malformed narrative payload (wrong shape) fails validation without throwing', () => {
  const result = parseRawNarrative({ readinessSummary: 123, steps: 'nope' });
  assert.equal(result.success, false);
});

test('a matching step id uses the narrated text', () => {
  const narrative: RawNarrative = {
    readinessSummary: 'summary',
    steps: [{ stepId: 'step-1', whyItMatters: 'AI why', evidenceBrief: 'AI brief' }],
  };
  const result = narratedTextForStep('step-1', fallback, narrative);
  assert.equal(result.whyItMatters, 'AI why');
  assert.equal(result.evidenceBrief, 'AI brief');
});

test('a missing step id falls back to the deterministic text', () => {
  const narrative: RawNarrative = {
    readinessSummary: 'summary',
    steps: [{ stepId: 'other-step', whyItMatters: 'AI why', evidenceBrief: 'AI brief' }],
  };
  const result = narratedTextForStep('step-1', fallback, narrative);
  assert.deepEqual(result, fallback);
});

test('an empty narrated string falls back to the deterministic text for that field only', () => {
  const narrative: RawNarrative = {
    readinessSummary: 'summary',
    steps: [{ stepId: 'step-1', whyItMatters: '   ', evidenceBrief: 'AI brief' }],
  };
  const result = narratedTextForStep('step-1', fallback, narrative);
  assert.equal(result.whyItMatters, fallback.whyItMatters);
  assert.equal(result.evidenceBrief, 'AI brief');
});

test('a null narrative (the AI call failed entirely) falls back to deterministic text for every step', () => {
  const result = narratedTextForStep('step-1', fallback, null);
  assert.deepEqual(result, fallback);
});

test('extra step ids in the narrative that were never requested are simply ignored', () => {
  const narrative: RawNarrative = {
    readinessSummary: 'summary',
    steps: [
      { stepId: 'step-1', whyItMatters: 'AI why', evidenceBrief: 'AI brief' },
      { stepId: 'invented-step', whyItMatters: 'should be ignored', evidenceBrief: 'should be ignored' },
    ],
  };
  const result = narratedTextForStep('step-2', fallback, narrative);
  assert.deepEqual(result, fallback);
});

test('readiness summary falls back to the deterministic sentence when narration is empty or absent', () => {
  assert.equal(narratedReadinessSummary('fallback summary', null), 'fallback summary');
  assert.equal(
    narratedReadinessSummary('fallback summary', { readinessSummary: '  ', steps: [] }),
    'fallback summary',
  );
  assert.equal(
    narratedReadinessSummary('fallback summary', { readinessSummary: 'AI summary', steps: [] }),
    'AI summary',
  );
});
