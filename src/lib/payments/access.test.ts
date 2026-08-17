import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEntitledPlan, type EntitlingPayment } from './access';

const NOW = new Date('2026-08-17T00:00:00.000Z');

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

test('no payments resolves to FREE with no expiry', () => {
  const result = resolveEntitledPlan([], NOW);
  assert.deepEqual(result, { plan: 'FREE', planExpiresAt: null });
});

test('only non-CAPTURED payments resolve to FREE', () => {
  const payments: EntitlingPayment[] = [
    { plan: 'CORE', status: 'CREATED', accessUntil: daysFromNow(30) },
    { plan: 'MAX', status: 'FAILED', accessUntil: daysFromNow(30) },
    { plan: 'CORE', status: 'REFUNDED', accessUntil: daysFromNow(30) },
  ];
  assert.deepEqual(resolveEntitledPlan(payments, NOW), { plan: 'FREE', planExpiresAt: null });
});

test('a captured payment with unexpired accessUntil entitles its plan', () => {
  const accessUntil = daysFromNow(10);
  const result = resolveEntitledPlan(
    [{ plan: 'CORE', status: 'CAPTURED', accessUntil }],
    NOW,
  );
  assert.deepEqual(result, { plan: 'CORE', planExpiresAt: accessUntil });
});

test('a captured payment whose accessUntil is exactly now no longer entitles (exclusive boundary)', () => {
  const result = resolveEntitledPlan(
    [{ plan: 'CORE', status: 'CAPTURED', accessUntil: NOW }],
    NOW,
  );
  assert.deepEqual(result, { plan: 'FREE', planExpiresAt: null });
});

test('a captured payment with a past accessUntil no longer entitles', () => {
  const result = resolveEntitledPlan(
    [{ plan: 'CORE', status: 'CAPTURED', accessUntil: daysFromNow(-1) }],
    NOW,
  );
  assert.deepEqual(result, { plan: 'FREE', planExpiresAt: null });
});

test('a captured payment with no accessUntil never entitles', () => {
  const result = resolveEntitledPlan(
    [{ plan: 'CORE', status: 'CAPTURED', accessUntil: null }],
    NOW,
  );
  assert.deepEqual(result, { plan: 'FREE', planExpiresAt: null });
});

test('overlapping CORE and MAX access resolves to the higher tier, MAX', () => {
  const coreExpiry = daysFromNow(5);
  const maxExpiry = daysFromNow(20);
  const result = resolveEntitledPlan(
    [
      { plan: 'CORE', status: 'CAPTURED', accessUntil: coreExpiry },
      { plan: 'MAX', status: 'CAPTURED', accessUntil: maxExpiry },
    ],
    NOW,
  );
  assert.deepEqual(result, { plan: 'MAX', planExpiresAt: maxExpiry });
});

test('when MAX access has expired but CORE access remains, the user falls back to CORE, not FREE', () => {
  const coreExpiry = daysFromNow(10);
  const result = resolveEntitledPlan(
    [
      { plan: 'CORE', status: 'CAPTURED', accessUntil: coreExpiry },
      { plan: 'MAX', status: 'CAPTURED', accessUntil: daysFromNow(-3) }, // expired
    ],
    NOW,
  );
  assert.deepEqual(result, { plan: 'CORE', planExpiresAt: coreExpiry });
});

test('multiple unexpired rows on the same plan (renewal history) resolve to the latest expiry', () => {
  const earlierExpiry = daysFromNow(5);
  const laterExpiry = daysFromNow(35);
  const result = resolveEntitledPlan(
    [
      { plan: 'CORE', status: 'CAPTURED', accessUntil: earlierExpiry },
      { plan: 'CORE', status: 'CAPTURED', accessUntil: laterExpiry },
    ],
    NOW,
  );
  assert.deepEqual(result, { plan: 'CORE', planExpiresAt: laterExpiry });
});

test('an expired older CORE row is ignored in favor of an unexpired newer one', () => {
  const laterExpiry = daysFromNow(15);
  const result = resolveEntitledPlan(
    [
      { plan: 'CORE', status: 'CAPTURED', accessUntil: daysFromNow(-20) }, // long-expired renewal history
      { plan: 'CORE', status: 'CAPTURED', accessUntil: laterExpiry },
    ],
    NOW,
  );
  assert.deepEqual(result, { plan: 'CORE', planExpiresAt: laterExpiry });
});
