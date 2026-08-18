import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { UsageLimitReachedError, usageLimitFromPayload } from '../../lib/usage/client';
import { ACTION_LABELS, UsageLimitNotice, formatRecoveryLabel, formatRecoveryTime } from './UsageLimitNotice';
import { selectHeaderUsage } from '../../lib/usage/presentation';
import { USAGE_ACTION_TYPES } from '../../lib/usage/config';
import type { UsageLimitDetails, UsageSummary } from '../../lib/usage/types';

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
      LEARNING_PATH: { used: 0, limit: 6, remaining: 6, nextAvailableAt: null },
    },
    planLimits: {
      FREE: { CHAT: 10, INGESTION: 4, AI_ACTION: 8, SKILL_INTELLIGENCE: 2, LEARNING_PATH: 2 },
      CORE: { CHAT: 40, INGESTION: 15, AI_ACTION: 25, SKILL_INTELLIGENCE: 6, LEARNING_PATH: 6 },
      MAX: { CHAT: 150, INGESTION: 50, AI_ACTION: 80, SKILL_INTELLIGENCE: 15, LEARNING_PATH: 15 },
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

// --- Exhaustive ACTION_LABELS: regression for the shipped "FREE undefined
// capacity reached" bug (SKILL_INTELLIGENCE / LEARNING_PATH were missing).
// The Record<MeteredUsageAction, string> type already makes an omission a
// compile error; this test additionally proves it at runtime so the guard
// survives even if the type annotation is ever loosened.

test('ACTION_LABELS has a real, non-empty label for every metered usage action', () => {
  assert.deepEqual(Object.keys(ACTION_LABELS).sort(), [...USAGE_ACTION_TYPES].sort());
  for (const action of USAGE_ACTION_TYPES) {
    assert.ok(ACTION_LABELS[action] && ACTION_LABELS[action].length > 0, `expected a real label for ${action}`);
  }
});

function details(overrides: Partial<UsageLimitDetails>): UsageLimitDetails {
  return {
    actionType: 'SKILL_INTELLIGENCE',
    plan: 'FREE',
    used: 2,
    limit: 2,
    remaining: 0,
    nextAvailableAt: null,
    ...overrides,
  };
}

function renderNotice(d: UsageLimitDetails): string {
  // Plain React.createElement, not JSX — this file is .test.ts (not
  // .test.tsx) so it stays matched by the existing test:usage npm script
  // glob (`src/components/usage/*.test.ts`), which would silently stop
  // picking it up if renamed to .tsx.
  return renderToStaticMarkup(
    React.createElement(MemoryRouter, null, React.createElement(UsageLimitNotice, { details: d })),
  );
}

test('the notice renders the real Skill Intelligence / Learning Path labels, never "undefined"', () => {
  const skillHtml = renderNotice(details({ actionType: 'SKILL_INTELLIGENCE', plan: 'FREE' }));
  assert.match(skillHtml, /Skill Intelligence capacity reached/);
  assert.doesNotMatch(skillHtml, /undefined/);

  const learningHtml = renderNotice(details({ actionType: 'LEARNING_PATH', plan: 'CORE' }));
  assert.match(learningHtml, /Learning Path capacity reached/);
  assert.doesNotMatch(learningHtml, /undefined/);
});

test('FREE and CORE notices render an upgrade CTA to /pricing', () => {
  for (const plan of ['FREE', 'CORE'] as const) {
    const html = renderNotice(details({ plan }));
    assert.match(html, /href="\/pricing"/);
    assert.match(html, /Upgrade for more capacity/);
  }
});

test('MAX notices never render an upgrade CTA — there is no higher tier to sell', () => {
  const html = renderNotice(details({ plan: 'MAX' }));
  assert.doesNotMatch(html, /href="\/pricing"/);
  assert.doesNotMatch(html, /Upgrade for more capacity/);
  // The usage-page link must still be present regardless of plan.
  assert.match(html, /href="\/usage"/);
});
