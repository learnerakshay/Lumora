import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma';
import { capturePayment } from './capture-service';
import { createCoupon, findCouponByCode } from './coupon-store';
import { syncUserEntitlement } from './entitlement-sync';
import { createPendingPayment, getPaymentByOrderId } from './payment-store';

const runDatabaseTests = process.env.RUN_DATABASE_PAYMENTS_TESTS === 'true';

test('syncUserEntitlement grants a plan from a captured payment and drops back to FREE once nothing entitles', { skip: !runDatabaseTests }, async () => {
  const userId = `entitlement-sync-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });

    const noPayments = await syncUserEntitlement(userId, 'ACCESS_REFRESH');
    assert.equal(noPayments.plan, 'FREE');
    assert.equal(noPayments.planExpiresAt, null);

    const orderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'CORE', providerOrderId: orderId, amount: 49_900, currency: 'INR' });
    await prisma.payment.update({
      where: { providerOrderId: orderId },
      data: {
        status: 'CAPTURED',
        providerPaymentId: `pay_${randomUUID()}`,
        accessFrom: new Date(),
        accessUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const granted = await syncUserEntitlement(userId, 'PAYMENT_VERIFIED');
    assert.equal(granted.changed, true);
    assert.equal(granted.plan, 'CORE');
    assert.ok(granted.planExpiresAt);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(user.plan, 'CORE');
    assert.ok(user.planExpiresAt);
    assert.ok(user.planUpdatedAt);

    // Force it into the past to simulate expiry, then resync.
    await prisma.payment.update({
      where: { providerOrderId: orderId },
      data: { accessUntil: new Date(Date.now() - 1000) },
    });
    const expired = await syncUserEntitlement(userId, 'ACCESS_EXPIRED');
    assert.equal(expired.changed, true);
    assert.equal(expired.plan, 'FREE');

    const userAfterExpiry = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(userAfterExpiry.plan, 'FREE');
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

test('capturePayment on a CREATED payment grants access and updates User.plan in one call', { skip: !runDatabaseTests }, async () => {
  const userId = `capture-flow-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });
    const orderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'CORE', providerOrderId: orderId, amount: 49_900, currency: 'INR' });

    const result = await capturePayment({
      providerOrderId: orderId,
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'upi',
      signatureVerified: true,
      reason: 'PAYMENT_VERIFIED',
    });

    assert.equal(result.captured, true);
    assert.equal(result.entitlement?.plan, 'CORE');

    const payment = await getPaymentByOrderId(orderId);
    assert.equal(payment?.status, 'CAPTURED');
    assert.ok(payment?.accessUntil);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(user.plan, 'CORE');
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

// Simulates /order/verify and the webhook both reaching capturePayment for
// the same order — the exact race Phase 2's design is meant to survive.
test('capturePayment called twice for the same order (verify racing the webhook) grants access exactly once', { skip: !runDatabaseTests }, async () => {
  const userId = `capture-race-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });
    const orderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'CORE', providerOrderId: orderId, amount: 49_900, currency: 'INR' });
    const providerPaymentId = `pay_${randomUUID()}`;

    const [first, second] = await Promise.all([
      capturePayment({ providerOrderId: orderId, providerPaymentId, method: 'upi', signatureVerified: true, reason: 'PAYMENT_VERIFIED' }),
      capturePayment({ providerOrderId: orderId, providerPaymentId, method: 'upi', signatureVerified: true, reason: 'WEBHOOK_PAYMENT_CAPTURED' }),
    ]);

    assert.equal(first.captured, true);
    assert.equal(second.captured, true);
    // Exactly one of the two actually performed the CREATED->CAPTURED transition.
    const reasons = [first.reason, second.reason].filter(Boolean);
    assert.equal(reasons.length, 1);
    assert.equal(reasons[0], 'ALREADY_CAPTURED');

    const payment = await getPaymentByOrderId(orderId);
    assert.equal(payment?.status, 'CAPTURED');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(user.plan, 'CORE');
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

test('capturing a renewal order for the same user and plan extends from the existing accessUntil rather than restarting', { skip: !runDatabaseTests }, async () => {
  const userId = `capture-renewal-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });

    const firstOrderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'CORE', providerOrderId: firstOrderId, amount: 49_900, currency: 'INR' });
    const firstResult = await capturePayment({
      providerOrderId: firstOrderId,
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'upi',
      signatureVerified: true,
      reason: 'PAYMENT_VERIFIED',
    });
    const firstAccessUntil = (await getPaymentByOrderId(firstOrderId))?.accessUntil;
    assert.ok(firstAccessUntil);
    assert.equal(firstResult.entitlement?.plan, 'CORE');

    const secondOrderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'CORE', providerOrderId: secondOrderId, amount: 49_900, currency: 'INR' });
    await capturePayment({
      providerOrderId: secondOrderId,
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'card',
      signatureVerified: true,
      reason: 'PAYMENT_VERIFIED',
    });
    const secondAccessUntil = (await getPaymentByOrderId(secondOrderId))?.accessUntil;
    assert.ok(secondAccessUntil);

    // Renewal stacking: the second purchase's window starts at the first's
    // accessUntil, so 30 days on top of 30 days is ~60 days from the first
    // purchase, not a fresh 30 from "now".
    const deltaMs = secondAccessUntil!.getTime() - firstAccessUntil!.getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(deltaMs - thirtyDaysMs) < 5_000, `expected ~30 days between windows, got ${deltaMs}ms`);
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

test('capturePayment increments the coupon redemption counter exactly once on capture', { skip: !runDatabaseTests }, async () => {
  const userId = `capture-coupon-${randomUUID()}`;
  const code = `PHASE2${randomUUID().slice(0, 8)}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });
    const coupon = await createCoupon({ code, kind: 'FIXED', value: 5_000, appliesToPlans: ['CORE'], perUserLimit: 1 });

    const orderId = `order_${randomUUID()}`;
    await createPendingPayment({
      userId,
      plan: 'CORE',
      providerOrderId: orderId,
      amount: 44_900,
      discountAmount: 5_000,
      currency: 'INR',
      couponId: coupon.id,
    });

    await capturePayment({
      providerOrderId: orderId,
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'upi',
      signatureVerified: true,
      reason: 'PAYMENT_VERIFIED',
    });

    const afterFirst = await findCouponByCode(code);
    assert.equal(afterFirst?.redemptionCount, 1);

    // A second capturePayment call for the SAME already-captured order (e.g.
    // a duplicate webhook) must not increment it again.
    await capturePayment({
      providerOrderId: orderId,
      providerPaymentId: `pay_other_${randomUUID()}`,
      method: 'upi',
      signatureVerified: true,
      reason: 'WEBHOOK_PAYMENT_CAPTURED',
    });
    const afterSecond = await findCouponByCode(code);
    assert.equal(afterSecond?.redemptionCount, 1);
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.coupon.deleteMany({ where: { code: code.toUpperCase() } });
  }
});

// This composition (MAX expires while an unexpired CORE payment exists ->
// fall back to CORE, not FREE) was previously only proven at the pure
// resolveEntitledPlan level (access.test.ts). This proves the same
// invariant through the real capturePayment -> syncUserEntitlement -> DB
// path, with two genuinely captured payments on two different plans.
test('when a MAX payment expires while an unexpired CORE payment still exists, entitlement falls back to CORE, not FREE', { skip: !runDatabaseTests }, async () => {
  const userId = `capture-max-fallback-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });

    const coreOrderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'CORE', providerOrderId: coreOrderId, amount: 49_900, currency: 'INR' });
    await capturePayment({
      providerOrderId: coreOrderId,
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'upi',
      signatureVerified: true,
      reason: 'PAYMENT_VERIFIED',
    });

    const maxOrderId = `order_${randomUUID()}`;
    await createPendingPayment({ userId, plan: 'MAX', providerOrderId: maxOrderId, amount: 149_900, currency: 'INR' });
    const maxResult = await capturePayment({
      providerOrderId: maxOrderId,
      providerPaymentId: `pay_${randomUUID()}`,
      method: 'card',
      signatureVerified: true,
      reason: 'PAYMENT_VERIFIED',
    });

    // MAX outranks CORE while both are unexpired.
    assert.equal(maxResult.entitlement?.plan, 'MAX');
    const userAfterMax = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(userAfterMax.plan, 'MAX');

    // Force only the MAX payment's access into the past; the CORE payment's
    // own ~30-day window (from its own capture moment) is untouched and
    // still unexpired.
    await prisma.payment.update({
      where: { providerOrderId: maxOrderId },
      data: { accessUntil: new Date(Date.now() - 1000) },
    });

    const afterMaxExpiry = await syncUserEntitlement(userId, 'ACCESS_EXPIRED');
    assert.equal(afterMaxExpiry.plan, 'CORE');
    assert.equal(afterMaxExpiry.changed, true);

    const userAfterFallback = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(userAfterFallback.plan, 'CORE');
    assert.ok(userAfterFallback.planExpiresAt);
  } finally {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

test('capturePayment on an unknown order returns ORDER_NOT_FOUND without throwing', { skip: !runDatabaseTests }, async () => {
  const result = await capturePayment({
    providerOrderId: `order_nonexistent_${randomUUID()}`,
    providerPaymentId: `pay_${randomUUID()}`,
    method: null,
    signatureVerified: true,
    reason: 'PAYMENT_VERIFIED',
  });
  assert.equal(result.captured, false);
  assert.equal(result.reason, 'ORDER_NOT_FOUND');
  assert.equal(result.entitlement, undefined);
});

test.after(async () => {
  if (runDatabaseTests) await prisma.$disconnect();
});
