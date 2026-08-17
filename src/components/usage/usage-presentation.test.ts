import assert from 'node:assert/strict';
import test from 'node:test';
import { UsageLimitReachedError, usageLimitFromPayload } from '../../lib/usage/client';
import { formatRecoveryLabel, formatRecoveryTime } from './UsageLimitNotice';
import { selectHeaderUsage } from '../../lib/usage/presentation';
import type { UsageSummary } from '../../lib/usage/types';

test('structured limit errors are recognized separately from provider failures', () => {
  const parsed = usageLimitFromPayload({
    error: {
      code: 'USAGE_LIMIT_REACHED',
      message: 'Capacity reached',
      details: {
        actionType: 'CHAT',
        plan: 'FREE',
        used: 8,
        limit: 8,
        remaining: 0,
        nextAvailableAt: '2026-08-14T16:12:00.000Z',
      },
    },
  });
  assert.ok(parsed instanceof UsageLimitReachedError);
  assert.equal(parsed?.details.actionType, 'CHAT');
  assert.equal(usageLimitFromPayload({ error: { code: 'OPENAI_TIMEOUT' } }), null);
});

test('rolling recovery wording is relative and never claims a daily reset', () => {
  const wording = formatRecoveryTime(
    '2026-08-14T16:12:00.000Z',
    new Date('2026-08-14T12:00:00.000Z').getTime(),
  );
  assert.match(wording, /4h 12m/);
  assert.doesNotMatch(wording, /reset|tomorrow/i);
  assert.match(formatRecoveryTime(null), /in-flight work/);
  assert.equal(formatRecoveryLabel(null), 'No capacity currently waiting to recover');
  assert.equal(
    formatRecoveryLabel('2026-08-14T16:12:00.000Z', new Date('2026-08-14T12:00:00.000Z').getTime()),
    'Next recovery in 4h 12m',
  );
});

test('header displays one real quota instead of a fabricated combined denominator', () => {
  const summary: UsageSummary = {
    plan: 'CORE',
    windowHours: 12,
    perAction: {
      CHAT: { used: 18, limit: 40, remaining: 22, nextAvailableAt: null },
      INGESTION: { used: 10, limit: 15, remaining: 5, nextAvailableAt: null },
      AI_ACTION: { used: 3, limit: 25, remaining: 22, nextAvailableAt: null },
      SKILL_INTELLIGENCE: { used: 1, limit: 6, remaining: 5, nextAvailableAt: null },
    },
    planLimits: {
      FREE: { CHAT: 10, INGESTION: 4, AI_ACTION: 8, SKILL_INTELLIGENCE: 2 },
      CORE: { CHAT: 40, INGESTION: 15, AI_ACTION: 25, SKILL_INTELLIGENCE: 6 },
      MAX: { CHAT: 150, INGESTION: 50, AI_ACTION: 80, SKILL_INTELLIGENCE: 15 },
    },
  };
  assert.deepEqual(selectHeaderUsage(summary), {
    actionType: 'INGESTION',
    label: 'Ingestion',
    compactLabel: 'Ingest',
    used: 10,
    limit: 15,
  });
});
