import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDiscount, normalizeCouponCode, validateCoupon, type CouponRecord } from './coupon';
import { MIN_ORDER_AMOUNT_PAISE } from './config';

const NOW = new Date('2026-08-17T00:00:00.000Z');

function makeCoupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    id: 'coupon_1',
    code: 'LAUNCH50',
    kind: 'PERCENT',
    value: 50,
    appliesToPlans: ['CORE', 'MAX'],
    maxRedemptions: null,
    redemptionCount: 0,
    perUserLimit: 1,
    validUntil: null,
    active: true,
    ...overrides,
  };
}

test('normalizeCouponCode trims and uppercases so equivalent codes collide', () => {
  assert.equal(normalizeCouponCode('launch50'), 'LAUNCH50');
  assert.equal(normalizeCouponCode(' LAUNCH50 '), 'LAUNCH50');
  assert.equal(normalizeCouponCode('LAUNCH50'), 'LAUNCH50');
});

test('applyDiscount rounds a percent discount to the nearest paisa', () => {
  // 33% of 1050 = 346.5 exactly at the rounding boundary -> rounds up (JS Math.round half-up)
  assert.equal(applyDiscount({ kind: 'PERCENT', value: 33, amount: 1_050 }), 347);
  // 50% of 49900 is an exact integer — no rounding involved
  assert.equal(applyDiscount({ kind: 'PERCENT', value: 50, amount: 49_900 }), 24_950);
});

test('applyDiscount clamps a percent value outside 0-100', () => {
  assert.equal(applyDiscount({ kind: 'PERCENT', value: 150, amount: 49_900 }), 49_900);
  assert.equal(applyDiscount({ kind: 'PERCENT', value: -20, amount: 49_900 }), 0);
});

test('applyDiscount clamps a fixed discount at the order amount', () => {
  assert.equal(applyDiscount({ kind: 'FIXED', value: 100_000, amount: 49_900 }), 49_900);
  assert.equal(applyDiscount({ kind: 'FIXED', value: 10_000, amount: 49_900 }), 10_000);
});

test('a valid coupon returns a discount and a reduced final amount', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ kind: 'FIXED', value: 10_000 }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.deepEqual(result, { valid: true, discountAmount: 10_000, finalAmount: 39_900 });
});

test('a missing coupon fails with COUPON_NOT_FOUND', () => {
  const result = validateCoupon({
    coupon: null,
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.equal(result.valid, false);
  assert.equal(!result.valid && result.code, 'COUPON_NOT_FOUND');
});

test('an inactive coupon fails with COUPON_INACTIVE', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ active: false }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.equal(result.valid, false);
  assert.equal(!result.valid && result.code, 'COUPON_INACTIVE');
});

test('an expired coupon fails with COUPON_EXPIRED', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ validUntil: new Date(NOW.getTime() - 1000) }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.equal(result.valid, false);
  assert.equal(!result.valid && result.code, 'COUPON_EXPIRED');
});

test('a not-yet-expired coupon (validUntil in the future) is still valid', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ validUntil: new Date(NOW.getTime() + 1000) }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.equal(result.valid, true);
});

test('a coupon scoped to the wrong plan fails with COUPON_NOT_APPLICABLE_TO_PLAN', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ appliesToPlans: ['MAX'] }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.equal(result.valid, false);
  assert.equal(!result.valid && result.code, 'COUPON_NOT_APPLICABLE_TO_PLAN');
});

test('a coupon at its global redemption cap fails with COUPON_LIMIT_REACHED', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ maxRedemptions: 100, redemptionCount: 100 }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.equal(result.valid, false);
  assert.equal(!result.valid && result.code, 'COUPON_LIMIT_REACHED');
});

test('a coupon below its global redemption cap is still valid', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ maxRedemptions: 100, redemptionCount: 99 }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.equal(result.valid, true);
});

test('a user who already redeemed up to their per-user limit fails with COUPON_ALREADY_USED', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ perUserLimit: 1 }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 1,
    now: NOW,
  });
  assert.equal(result.valid, false);
  assert.equal(!result.valid && result.code, 'COUPON_ALREADY_USED');
});

test('a per-user-limit-2 coupon allows a second redemption (e.g. renewal)', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ perUserLimit: 2 }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 1,
    now: NOW,
  });
  assert.equal(result.valid, true);
});

test('a 100%-off coupon never produces a chargeable amount below the Razorpay minimum', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ kind: 'PERCENT', value: 100 }),
    plan: 'CORE',
    amount: 49_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.finalAmount, MIN_ORDER_AMOUNT_PAISE);
    assert.equal(result.discountAmount, 49_900 - MIN_ORDER_AMOUNT_PAISE);
    assert.equal(result.discountAmount + result.finalAmount, 49_900);
  }
});

test('an over-value fixed coupon also clamps at the Razorpay minimum, never going to zero or negative', () => {
  const result = validateCoupon({
    coupon: makeCoupon({ kind: 'FIXED', value: 1_000_000 }),
    plan: 'MAX',
    amount: 149_900,
    userCapturedRedemptions: 0,
    now: NOW,
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.finalAmount, MIN_ORDER_AMOUNT_PAISE);
    assert.ok(result.finalAmount > 0);
  }
});
