import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PLAN_LIMITS, PLAN_NAMES, USAGE_ACTION_TYPES, USAGE_WINDOW_MS } from '../usage/config';
import { PAID_PLANS, PLAN_ACCESS_DAYS_DEFAULT, PLAN_PRICING_PAISE } from './config';
import {
  ACCESS_TERMS_LABEL,
  COMPARISON_ROWS,
  LIMIT_COMPARISON_ROWS,
  PRICING_PLANS,
  SHARED_CAPABILITY_HEADER,
  SHARED_CAPABILITY_ROWS,
  USAGE_WINDOW_HOURS,
  USAGE_WINDOW_LABEL,
  formatInr,
  getPlanCard,
} from './pricing-presentation';

test('PRICING_PLANS covers every plan in PLAN_NAMES, in order', () => {
  assert.deepEqual(
    PRICING_PLANS.map((card) => card.plan),
    [...PLAN_NAMES],
  );
});

test('every plan card limit block matches PLAN_LIMITS exactly', () => {
  for (const plan of PLAN_NAMES) {
    const card = getPlanCard(plan);
    assert.deepEqual(card.limits, PLAN_LIMITS[plan]);
  }
});

test('FREE renders as zero with no list price and no badge', () => {
  const free = getPlanCard('FREE');
  assert.equal(free.isPaid, false);
  assert.equal(free.priceLabel, formatInr(0));
  assert.equal(free.listPriceLabel, null);
  assert.equal(free.badge, null);
  assert.equal(free.accessDays, null);
});

test('paid plan prices derive from PLAN_PRICING_PAISE, not a literal', () => {
  for (const plan of PAID_PLANS) {
    const card = getPlanCard(plan);
    assert.equal(card.isPaid, true);
    assert.equal(card.priceLabel, formatInr(PLAN_PRICING_PAISE[plan].launchAmount));
    assert.equal(card.listPriceLabel, formatInr(PLAN_PRICING_PAISE[plan].listAmount));
    assert.equal(card.accessDays, PLAN_ACCESS_DAYS_DEFAULT);
  }
});

test('CORE and only CORE is badged Most popular', () => {
  const badged = PRICING_PLANS.filter((card) => card.badge !== null);
  assert.equal(badged.length, 1);
  assert.equal(badged[0].plan, 'CORE');
  assert.equal(badged[0].badge, 'Most popular');
});

test('LIMIT_COMPARISON_ROWS has exactly one row per metered action, values matching PLAN_LIMITS', () => {
  assert.equal(LIMIT_COMPARISON_ROWS.length, USAGE_ACTION_TYPES.length);
  assert.deepEqual(
    LIMIT_COMPARISON_ROWS.map((row) => row.action).sort(),
    [...USAGE_ACTION_TYPES].sort(),
  );
  for (const row of LIMIT_COMPARISON_ROWS) {
    for (const plan of PLAN_NAMES) {
      assert.equal(row.values[plan], PLAN_LIMITS[plan][row.action]);
    }
  }
});

test('SHARED_CAPABILITY_ROWS are all marked available on every plan', () => {
  assert.ok(SHARED_CAPABILITY_ROWS.length > 0);
  for (const row of SHARED_CAPABILITY_ROWS) {
    assert.equal(row.values, 'all');
    assert.ok(row.label.length > 0);
  }
});

test('COMPARISON_ROWS is exactly the limit rows followed by the capability rows', () => {
  assert.equal(COMPARISON_ROWS.length, LIMIT_COMPARISON_ROWS.length + SHARED_CAPABILITY_ROWS.length);
  assert.deepEqual(COMPARISON_ROWS.slice(0, LIMIT_COMPARISON_ROWS.length), LIMIT_COMPARISON_ROWS);
});

test('the rolling usage window label reflects USAGE_WINDOW_MS, not a hardcoded "12"', () => {
  assert.equal(USAGE_WINDOW_HOURS, USAGE_WINDOW_MS / (60 * 60 * 1000));
  assert.equal(USAGE_WINDOW_LABEL, `per rolling ${USAGE_WINDOW_HOURS}-hour window`);
  assert.match(USAGE_WINDOW_LABEL, /rolling \d+-hour window/);
});

test('access terms label states one-time payment, real access-day count, and no auto-renewal', () => {
  assert.equal(ACCESS_TERMS_LABEL, `One-time payment · ${PLAN_ACCESS_DAYS_DEFAULT} days access · No auto-renewal`);
  assert.match(ACCESS_TERMS_LABEL, /One-time payment/);
  assert.match(ACCESS_TERMS_LABEL, /No auto-renewal/);
});

test('shared capability header explains capacity-only differentiation using the real window length', () => {
  assert.match(SHARED_CAPABILITY_HEADER, new RegExp(`${USAGE_WINDOW_HOURS}-hour window`));
  assert.match(SHARED_CAPABILITY_HEADER, /every plan/i);
});

test('formatInr renders whole-rupee INR with no decimals', () => {
  assert.equal(formatInr(49_900), '₹499');
  assert.equal(formatInr(0), '₹0');
});

// Anti-drift guard: this module must never hardcode a plan limit or a rupee
// amount. If someone pastes a literal instead of deriving it, this test
// should catch it before it can silently diverge from PLAN_LIMITS /
// PLAN_PRICING_PAISE.
test('module source contains no hardcoded plan-limit or price digit literals', () => {
  const source = readFileSync(new URL('./pricing-presentation.ts', import.meta.url), 'utf8');
  const forbiddenNumbers = new Set<number>();
  for (const plan of PLAN_NAMES) {
    for (const action of USAGE_ACTION_TYPES) {
      forbiddenNumbers.add(PLAN_LIMITS[plan][action]);
    }
  }
  for (const plan of PAID_PLANS) {
    forbiddenNumbers.add(PLAN_PRICING_PAISE[plan].listAmount);
    forbiddenNumbers.add(PLAN_PRICING_PAISE[plan].launchAmount);
  }
  // Strip comments so prose mentioning a number in an explanation doesn't
  // false-positive; only check executable code lines.
  const codeOnly = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  for (const value of forbiddenNumbers) {
    if (value < 10) continue; // small numbers (e.g. single digits) are too generic to police
    const pattern = new RegExp(`(?<![\\w.])${value}(?![\\w])`);
    assert.doesNotMatch(
      codeOnly,
      pattern,
      `found literal ${value} in pricing-presentation.ts — derive it from PLAN_LIMITS/PLAN_PRICING_PAISE instead`,
    );
  }
});
