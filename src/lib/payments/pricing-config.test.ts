import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPaidPlan,
  launchAmountFor,
  listAmountFor,
  MIN_ORDER_AMOUNT_PAISE,
  PAID_PLANS,
  PLAN_ACCESS_DAYS_DEFAULT,
  PLAN_PRICING_PAISE,
} from './config';

test('PAID_PLANS is exactly CORE and MAX — FREE is never purchasable', () => {
  assert.deepEqual(PAID_PLANS, ['CORE', 'MAX']);
  assert.equal(isPaidPlan('FREE'), false);
  assert.equal(isPaidPlan('CORE'), true);
  assert.equal(isPaidPlan('MAX'), true);
  assert.equal(isPaidPlan('ENTERPRISE'), false);
});

test('every paid plan price is an integer number of paise', () => {
  for (const plan of PAID_PLANS) {
    assert.ok(Number.isInteger(PLAN_PRICING_PAISE[plan].listAmount));
    assert.ok(Number.isInteger(PLAN_PRICING_PAISE[plan].launchAmount));
  }
});

test('launch price is strictly below list price for every paid plan (real discount, not decorative)', () => {
  for (const plan of PAID_PLANS) {
    assert.ok(
      launchAmountFor(plan) < listAmountFor(plan),
      `${plan} launch price must be below its list price`,
    );
  }
});

test('locked launch pricing: CORE ₹499/mo, MAX ₹1,499/mo', () => {
  assert.equal(launchAmountFor('CORE'), 49_900);
  assert.equal(launchAmountFor('MAX'), 149_900);
});

test('locked list (strike-through) pricing: CORE ₹999, MAX ₹2,499', () => {
  assert.equal(listAmountFor('CORE'), 99_900);
  assert.equal(listAmountFor('MAX'), 249_900);
});

test('MAX costs more than CORE at both list and launch price', () => {
  assert.ok(launchAmountFor('MAX') > launchAmountFor('CORE'));
  assert.ok(listAmountFor('MAX') > listAmountFor('CORE'));
});

test('access grants default to 30 days', () => {
  assert.equal(PLAN_ACCESS_DAYS_DEFAULT, 30);
});

test('the minimum order amount is a positive number of paise below every plan price', () => {
  assert.ok(MIN_ORDER_AMOUNT_PAISE > 0);
  for (const plan of PAID_PLANS) {
    assert.ok(MIN_ORDER_AMOUNT_PAISE < launchAmountFor(plan));
  }
});
