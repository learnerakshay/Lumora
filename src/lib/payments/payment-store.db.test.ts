import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma';
import {
  countUserCapturedCouponRedemptions,
  createPendingPayment,
  getCapturedPaymentsForUser,
  getLatestUnexpiredAccessUntil,
  getPaymentByOrderId,
  getPaymentHistoryForUser,
  markPaymentCaptured,
  markPaymentFailed,
} from './payment-store';
import { recordWebhookEvent } from './webhook-store';
import { createCoupon, findCouponByCode, incrementCouponRedemption } from './coupon-store';

const runDatabaseTests = process.env.RUN_DATABASE_PAYMENTS_TESTS === 'true';

test('a pending payment can be captured exactly once; a second capture attempt is a no-op', { skip: !runDatabaseTests }, async () => {
  const userId = `payments-capture-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });
    const orderId = `order_${randomUUID()}`;
    const created = await createPendingPayment({
      userId,
      plan: 'CORE',
      providerOrderId: orderId,
      amount: 49_900,
      currency: 'INR',
    });
    assert.equal(created.status, 'CREATED');

    const now = new Date();
    const accessUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const captured = await markPaymentCaptured(orderId, {
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'upi',
      accessFrom: now,
      accessUntil,
      signatureVerified: true,
    });
    assert.ok(captured);
    assert.equal(captured?.status, 'CAPTURED');

    // Simulates a duplicate webhook delivery for the same order.
    const secondCapture = await markPaymentCaptured(orderId, {
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'upi',
      accessFrom: now,
      accessUntil,
      signatureVerified: true,
    });
    assert.equal(secondCapture, null);

    const fetched = await getPaymentByOrderId(orderId);
    assert.equal(fetched?.status, 'CAPTURED');
    assert.equal(fetched?.method, 'upi');

    const capturedForUser = await getCapturedPaymentsForUser(userId);
    assert.equal(capturedForUser.length, 1);
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

test('a pending payment can be marked failed and never counts as captured', { skip: !runDatabaseTests }, async () => {
  const userId = `payments-fail-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });
    const orderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'MAX', providerOrderId: orderId, amount: 149_900, currency: 'INR' });

    const failed = await markPaymentFailed(orderId, { failureCode: 'BAD_REQUEST_ERROR', failureReason: 'Card declined' });
    assert.equal(failed?.status, 'FAILED');

    const capturedForUser = await getCapturedPaymentsForUser(userId);
    assert.equal(capturedForUser.length, 0);

    const history = await getPaymentHistoryForUser(userId);
    assert.equal(history.length, 1);
    assert.equal(history[0].failureReason, 'Card declined');
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

test('getLatestUnexpiredAccessUntil finds the same-plan renewal target and ignores other plans/expired rows', { skip: !runDatabaseTests }, async () => {
  const userId = `payments-window-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });
    const now = new Date();

    const expiredOrderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'CORE', providerOrderId: expiredOrderId, amount: 49_900, currency: 'INR' });
    await markPaymentCaptured(expiredOrderId, {
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'card',
      accessFrom: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      accessUntil: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // already expired
      signatureVerified: true,
    });

    const activeOrderId = `order_${randomUUID()}`;
    const activeAccessUntil = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000);
    await createPendingPayment({ userId, plan: 'CORE', providerOrderId: activeOrderId, amount: 49_900, currency: 'INR' });
    await markPaymentCaptured(activeOrderId, {
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'upi',
      accessFrom: now,
      accessUntil: activeAccessUntil,
      signatureVerified: true,
    });

    const maxOrderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'MAX', providerOrderId: maxOrderId, amount: 149_900, currency: 'INR' });
    await markPaymentCaptured(maxOrderId, {
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'netbanking',
      accessFrom: now,
      accessUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      signatureVerified: true,
    });

    const coreTarget = await getLatestUnexpiredAccessUntil(userId, 'CORE', now);
    assert.equal(coreTarget?.getTime(), activeAccessUntil.getTime());

    const otherUserTarget = await getLatestUnexpiredAccessUntil(`nonexistent-${randomUUID()}`, 'CORE', now);
    assert.equal(otherUserTarget, null);
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

test('recordWebhookEvent is idempotent on eventId: a duplicate delivery inserts nothing', { skip: !runDatabaseTests }, async () => {
  const eventId = `evt_${randomUUID()}`;
  try {
    const first = await recordWebhookEvent({ eventId, eventType: 'payment.captured', payload: { id: 'pay_1' } });
    assert.equal(first.inserted, true);

    const duplicate = await recordWebhookEvent({ eventId, eventType: 'payment.captured', payload: { id: 'pay_1' } });
    assert.equal(duplicate.inserted, false);

    const count = await prisma.webhookEvent.count({ where: { eventId } });
    assert.equal(count, 1);
  } finally {
    await prisma.webhookEvent.deleteMany({ where: { eventId } });
  }
});

test('coupon lookup normalizes the code and redemption increments persist', { skip: !runDatabaseTests }, async () => {
  const code = `TESTCOUPON${randomUUID().slice(0, 8)}`;
  try {
    const created = await createCoupon({
      code,
      kind: 'PERCENT',
      value: 50,
      appliesToPlans: ['CORE', 'MAX'],
      maxRedemptions: 10,
      perUserLimit: 1,
    });
    assert.equal(created.code, code.toUpperCase());

    const found = await findCouponByCode(` ${code.toLowerCase()} `);
    assert.ok(found);
    assert.equal(found?.redemptionCount, 0);

    await incrementCouponRedemption(created.id);
    const afterIncrement = await findCouponByCode(code);
    assert.equal(afterIncrement?.redemptionCount, 1);
  } finally {
    await prisma.coupon.deleteMany({ where: { code: code.toUpperCase() } });
  }
});

test('countUserCapturedCouponRedemptions counts only CAPTURED payments against that coupon', { skip: !runDatabaseTests }, async () => {
  const userId = `payments-coupon-${randomUUID()}`;
  const code = `RENEW${randomUUID().slice(0, 8)}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });
    const coupon = await createCoupon({ code, kind: 'FIXED', value: 5_000, appliesToPlans: ['CORE'], perUserLimit: 5 });

    const capturedOrderId = `order_${randomUUID()}`;
    await createPendingPayment({
      userId,
      plan: 'CORE',
      providerOrderId: capturedOrderId,
      amount: 44_900,
      discountAmount: 5_000,
      currency: 'INR',
      couponId: coupon.id,
    });
    await markPaymentCaptured(capturedOrderId, {
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'upi',
      accessFrom: new Date(),
      accessUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      signatureVerified: true,
    });

    const failedOrderId = `order_${randomUUID()}`;
    await createPendingPayment({
      userId,
      plan: 'CORE',
      providerOrderId: failedOrderId,
      amount: 44_900,
      discountAmount: 5_000,
      currency: 'INR',
      couponId: coupon.id,
    });
    await markPaymentFailed(failedOrderId, { failureCode: 'X', failureReason: 'declined' });

    const redemptions = await countUserCapturedCouponRedemptions(userId, coupon.id);
    assert.equal(redemptions, 1); // only the CAPTURED one counts
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.coupon.deleteMany({ where: { code: code.toUpperCase() } });
  }
});

test.after(async () => {
  if (runDatabaseTests) await prisma.$disconnect();
});
