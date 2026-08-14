import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnswerMode } from '../../types';
import {
  RESPONSE_MODE_CONTRACTS,
  responseModeInstructions,
} from './response-mode-contract';

test('all four AI Modes define one bounded response contract', () => {
  const modes = Object.keys(RESPONSE_MODE_CONTRACTS) as AnswerMode[];
  assert.deepEqual(modes, ['CONCISE', 'DETAILED', 'CRITICAL', 'CREATIVE']);
  assert.equal(RESPONSE_MODE_CONTRACTS.CONCISE.maxOutputTokens, 2_048);
  assert.equal(RESPONSE_MODE_CONTRACTS.DETAILED.maxOutputTokens, 6_144);
  assert.equal(RESPONSE_MODE_CONTRACTS.CRITICAL.maxOutputTokens, 5_120);
  assert.equal(RESPONSE_MODE_CONTRACTS.CREATIVE.maxOutputTokens, 5_120);
  assert.ok(
    RESPONSE_MODE_CONTRACTS.DETAILED.maxOutputTokens >
      RESPONSE_MODE_CONTRACTS.CONCISE.maxOutputTokens,
  );
  for (const mode of modes) {
    const instructions = responseModeInstructions(mode);
    assert.match(instructions, /finish cleanly within the response budget/i);
    assert.match(instructions, /prioritize and synthesize/i);
  }
});
