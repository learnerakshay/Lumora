import assert from 'node:assert/strict';
import test from 'node:test';
import { computeAccessWindow } from './access';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_AT = new Date('2026-08-17T00:00:00.000Z');

test('a fresh purchase (no existing access) starts from paidAt and runs 30 days', () => {
  const { accessFrom, accessUntil } = computeAccessWindow({ paidAt: PAID_AT, existingAccessUntil: null });
  assert.equal(accessFrom.getTime(), PAID_AT.getTime());
  assert.equal(accessUntil.getTime(), PAID_AT.getTime() + 30 * DAY_MS);
});

test('renewing with 12 days remaining extends from the existing expiry, not from paidAt', () => {
  const existingAccessUntil = new Date(PAID_AT.getTime() + 12 * DAY_MS);
  const { accessFrom, accessUntil } = computeAccessWindow({
    paidAt: PAID_AT,
    existingAccessUntil,
  });
  assert.equal(accessFrom.getTime(), existingAccessUntil.getTime());
  // 12 days remaining + a fresh 30-day grant = 42 days from the renewal payment.
  assert.equal(accessUntil.getTime(), PAID_AT.getTime() + 42 * DAY_MS);
});

test('renewing after expiry starts fresh from paidAt, discarding the stale expiry', () => {
  const existingAccessUntil = new Date(PAID_AT.getTime() - 1 * DAY_MS); // expired yesterday
  const { accessFrom, accessUntil } = computeAccessWindow({
    paidAt: PAID_AT,
    existingAccessUntil,
  });
  assert.equal(accessFrom.getTime(), PAID_AT.getTime());
  assert.equal(accessUntil.getTime(), PAID_AT.getTime() + 30 * DAY_MS);
});

test('renewing at the exact expiry instant starts fresh (exclusive boundary)', () => {
  const { accessFrom, accessUntil } = computeAccessWindow({
    paidAt: PAID_AT,
    existingAccessUntil: PAID_AT,
  });
  assert.equal(accessFrom.getTime(), PAID_AT.getTime());
  assert.equal(accessUntil.getTime(), PAID_AT.getTime() + 30 * DAY_MS);
});

// Cross-plan access never stacks: the caller (Phase 2) is responsible for
// only passing existingAccessUntil when it belongs to the SAME plan being
// purchased. Passing null (as it must for a different plan) behaves exactly
// like a fresh purchase.
test('a null existingAccessUntil (as passed for a different plan) behaves like a fresh purchase', () => {
  const { accessFrom, accessUntil } = computeAccessWindow({ paidAt: PAID_AT, existingAccessUntil: null });
  assert.equal(accessFrom.getTime(), PAID_AT.getTime());
  assert.equal(accessUntil.getTime(), PAID_AT.getTime() + 30 * DAY_MS);
});

test('a custom accessDays overrides the 30-day default', () => {
  const { accessUntil } = computeAccessWindow({ paidAt: PAID_AT, existingAccessUntil: null, accessDays: 7 });
  assert.equal(accessUntil.getTime(), PAID_AT.getTime() + 7 * DAY_MS);
});
