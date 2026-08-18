import assert from 'node:assert/strict';
import test from 'node:test';
import type { PaymentHistoryRecord } from '../../components/payments/usePaymentHistory';
import {
  daysRemaining,
  expiryBand,
  hadPaidAccess,
  latestCapturedAccess,
  purchaseDateFrom,
  stackingCopyFor,
} from './access-presentation';

const NOW = new Date('2026-08-18T00:00:00.000Z');

function iso(daysFromNow: number): string {
  return new Date(NOW.getTime() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

function record(overrides: Partial<PaymentHistoryRecord>): PaymentHistoryRecord {
  return {
    id: 'pay_1',
    userId: 'user_1',
    plan: 'CORE',
    providerOrderId: 'order_1',
    providerPaymentId: 'pay_provider_1',
    amount: 49900,
    discountAmount: 0,
    currency: 'INR',
    status: 'CAPTURED',
    method: 'card',
    failureCode: null,
    failureReason: null,
    accessFrom: iso(-5),
    accessUntil: iso(25),
    couponId: null,
    signatureVerified: true,
    createdAt: iso(-5),
    updatedAt: iso(-5),
    ...overrides,
  };
}

// --- daysRemaining -----------------------------------------------------

test('daysRemaining returns 0 for a null expiry (FREE / no access)', () => {
  assert.equal(daysRemaining(null, NOW), 0);
});

test('daysRemaining ceils partial days up', () => {
  const expiresAt = new Date(NOW.getTime() + 1.2 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(daysRemaining(expiresAt, NOW), 2);
});

test('daysRemaining is exactly 0 at the boundary — accessUntil is exclusive, not "last day"', () => {
  assert.equal(daysRemaining(NOW.toISOString(), NOW), 0);
});

test('daysRemaining is 0 (not negative) once expiry is in the past', () => {
  assert.equal(daysRemaining(iso(-3), NOW), 0);
});

test('daysRemaining accepts a Date object as well as an ISO string', () => {
  const expiresAt = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000);
  assert.equal(daysRemaining(expiresAt, NOW), 3);
});

// --- expiryBand ----------------------------------------------------------

test('expiryBand is "none" for FREE regardless of any expiry value', () => {
  assert.equal(expiryBand('FREE', iso(1), NOW), 'none');
  assert.equal(expiryBand('FREE', null, NOW), 'none');
});

test('expiryBand is "none" for a paid plan with no expiry on record', () => {
  assert.equal(expiryBand('CORE', null, NOW), 'none');
});

test('expiryBand is "none" when more than 7 days remain', () => {
  assert.equal(expiryBand('CORE', iso(8), NOW), 'none');
});

test('expiryBand is "approaching" at exactly 7 days and anywhere within (2, 7] days', () => {
  assert.equal(expiryBand('CORE', iso(7), NOW), 'approaching');
  assert.equal(expiryBand('CORE', iso(3), NOW), 'approaching');
});

test('expiryBand is "urgent" at exactly 2 days and 1 day', () => {
  assert.equal(expiryBand('CORE', iso(2), NOW), 'urgent');
  assert.equal(expiryBand('CORE', iso(1), NOW), 'urgent');
});

test('expiryBand is "expired" exactly at the boundary and after it', () => {
  assert.equal(expiryBand('CORE', NOW.toISOString(), NOW), 'expired');
  assert.equal(expiryBand('MAX', iso(-1), NOW), 'expired');
});

// --- hadPaidAccess / purchaseDateFrom / latestCapturedAccess -----------

test('hadPaidAccess is false with no history and false with only non-captured rows', () => {
  assert.equal(hadPaidAccess([]), false);
  assert.equal(hadPaidAccess([record({ status: 'CREATED' }), record({ status: 'FAILED' })]), false);
});

test('hadPaidAccess is true once any row is CAPTURED', () => {
  assert.equal(hadPaidAccess([record({ status: 'FAILED' }), record({ status: 'CAPTURED' })]), true);
});

test('purchaseDateFrom returns null with no captured history', () => {
  assert.equal(purchaseDateFrom([record({ status: 'CREATED', accessFrom: null })]), null);
});

test('purchaseDateFrom picks the most recently created CAPTURED row\'s accessFrom, ignoring array order', () => {
  const older = record({ id: 'p1', status: 'CAPTURED', createdAt: iso(-20), accessFrom: iso(-20) });
  const newer = record({ id: 'p2', status: 'CAPTURED', createdAt: iso(-2), accessFrom: iso(-2) });
  assert.equal(purchaseDateFrom([newer, older]), newer.accessFrom);
  assert.equal(purchaseDateFrom([older, newer]), newer.accessFrom);
});

test('purchaseDateFrom ignores non-captured rows even if they are the newest', () => {
  const captured = record({ id: 'p1', status: 'CAPTURED', createdAt: iso(-10), accessFrom: iso(-10) });
  const laterFailed = record({ id: 'p2', status: 'FAILED', createdAt: iso(-1), accessFrom: null });
  assert.equal(purchaseDateFrom([captured, laterFailed]), captured.accessFrom);
});

test('latestCapturedAccess returns the most recent captured payment\'s plan and accessUntil', () => {
  const older = record({ id: 'p1', plan: 'CORE', status: 'CAPTURED', createdAt: iso(-20), accessUntil: iso(10) });
  const newer = record({ id: 'p2', plan: 'MAX', status: 'CAPTURED', createdAt: iso(-1), accessUntil: iso(29) });
  assert.deepEqual(latestCapturedAccess([older, newer]), { plan: 'MAX', accessUntil: newer.accessUntil });
});

test('latestCapturedAccess is null with no captured rows', () => {
  assert.equal(latestCapturedAccess([record({ status: 'CREATED' })]), null);
});

// --- stackingCopyFor: preserves existing access.ts semantics exactly -----

test('same-plan purchase is described as a renewal that stacks, never resets', () => {
  const copy = stackingCopyFor('CORE', 'CORE');
  assert.equal(copy.kind, 'renewal');
  assert.match(copy.detail, /added to your remaining time/);
  assert.match(copy.detail, /nothing is lost by renewing early/);
});

test('CORE -> MAX is described as starting now while CORE time is preserved underneath, never as proration', () => {
  const copy = stackingCopyFor('CORE', 'MAX');
  assert.equal(copy.kind, 'upgrade');
  assert.match(copy.detail, /starts today for 30 days/);
  assert.match(copy.detail, /remaining CORE days are preserved/);
  assert.doesNotMatch(copy.detail, /prorat/i);
});

test('MAX -> MAX renewal uses the renewal copy, not the upgrade copy', () => {
  const copy = stackingCopyFor('MAX', 'MAX');
  assert.equal(copy.kind, 'renewal');
});

test('FREE -> CORE/MAX is a fresh purchase with no stacking claim', () => {
  const toCore = stackingCopyFor('FREE', 'CORE');
  assert.equal(toCore.kind, 'upgrade');
  assert.match(toCore.detail, /starts today for 30 days/);
  assert.doesNotMatch(toCore.detail, /preserved|remaining/);
});

test('no stacking copy anywhere mentions proration, subscriptions, or auto-renewal', () => {
  const allCopy = [
    stackingCopyFor('CORE', 'CORE'),
    stackingCopyFor('MAX', 'MAX'),
    stackingCopyFor('CORE', 'MAX'),
    stackingCopyFor('FREE', 'CORE'),
    stackingCopyFor('FREE', 'MAX'),
  ];
  for (const copy of allCopy) {
    assert.doesNotMatch(copy.headline + ' ' + copy.detail, /prorat|subscription|auto-renew|cancel anytime/i);
  }
});
