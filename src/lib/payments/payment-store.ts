import { prisma } from '../prisma';
import type { PaidPlan } from './config';
import type { PaymentStatus } from './types';

export interface PaymentRecord {
  id: string;
  userId: string;
  plan: PaidPlan;
  providerOrderId: string;
  providerPaymentId: string | null;
  amount: number;
  discountAmount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  failureCode: string | null;
  failureReason: string | null;
  accessFrom: Date | null;
  accessUntil: Date | null;
  couponId: string | null;
  signatureVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

function toPaymentRecord(row: {
  id: string;
  userId: string;
  plan: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  amount: number;
  discountAmount: number;
  currency: string;
  status: string;
  method: string | null;
  failureCode: string | null;
  failureReason: string | null;
  accessFrom: Date | null;
  accessUntil: Date | null;
  couponId: string | null;
  signatureVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PaymentRecord {
  return {
    id: row.id,
    userId: row.userId,
    plan: row.plan as PaidPlan,
    providerOrderId: row.providerOrderId,
    providerPaymentId: row.providerPaymentId,
    amount: row.amount,
    discountAmount: row.discountAmount,
    currency: row.currency,
    status: row.status as PaymentStatus,
    method: row.method,
    failureCode: row.failureCode,
    failureReason: row.failureReason,
    accessFrom: row.accessFrom,
    accessUntil: row.accessUntil,
    couponId: row.couponId,
    signatureVerified: row.signatureVerified,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createPendingPayment(input: {
  userId: string;
  plan: PaidPlan;
  providerOrderId: string;
  amount: number;
  discountAmount?: number;
  currency: string;
  couponId?: string | null;
}): Promise<PaymentRecord> {
  const created = await prisma.payment.create({
    data: {
      userId: input.userId,
      plan: input.plan,
      providerOrderId: input.providerOrderId,
      amount: input.amount,
      discountAmount: input.discountAmount ?? 0,
      currency: input.currency,
      couponId: input.couponId ?? null,
      status: 'CREATED',
    },
  });
  return toPaymentRecord(created);
}

// Transitions CREATED -> CAPTURED exactly once. If the row is already
// CAPTURED (a duplicate webhook, or the verify-call and the webhook racing
// each other), this is a no-op and returns null — callers must treat that as
// "nothing to do", not an error.
export async function markPaymentCaptured(
  providerOrderId: string,
  data: {
    providerPaymentId: string;
    method: string | null;
    accessFrom: Date;
    accessUntil: Date;
    signatureVerified: boolean;
  },
): Promise<PaymentRecord | null> {
  const result = await prisma.payment.updateMany({
    where: { providerOrderId, status: 'CREATED' },
    data: {
      status: 'CAPTURED',
      providerPaymentId: data.providerPaymentId,
      method: data.method,
      accessFrom: data.accessFrom,
      accessUntil: data.accessUntil,
      signatureVerified: data.signatureVerified,
    },
  });
  if (result.count === 0) return null;
  const updated = await prisma.payment.findUnique({ where: { providerOrderId } });
  return updated ? toPaymentRecord(updated) : null;
}

// Transitions CREATED -> FAILED. Also a no-op (returns null) if the payment
// already reached a terminal status.
export async function markPaymentFailed(
  providerOrderId: string,
  data: {
    providerPaymentId?: string | null;
    failureCode?: string | null;
    failureReason?: string | null;
  },
): Promise<PaymentRecord | null> {
  const result = await prisma.payment.updateMany({
    where: { providerOrderId, status: 'CREATED' },
    data: {
      status: 'FAILED',
      providerPaymentId: data.providerPaymentId ?? undefined,
      failureCode: data.failureCode ?? null,
      failureReason: data.failureReason ?? null,
    },
  });
  if (result.count === 0) return null;
  const updated = await prisma.payment.findUnique({ where: { providerOrderId } });
  return updated ? toPaymentRecord(updated) : null;
}

export async function getPaymentByOrderId(providerOrderId: string): Promise<PaymentRecord | null> {
  const row = await prisma.payment.findUnique({ where: { providerOrderId } });
  return row ? toPaymentRecord(row) : null;
}

export async function getPaymentByProviderPaymentId(providerPaymentId: string): Promise<PaymentRecord | null> {
  const row = await prisma.payment.findUnique({ where: { providerPaymentId } });
  return row ? toPaymentRecord(row) : null;
}

// All CAPTURED payments for a user, for feeding resolveEntitledPlan.
export async function getCapturedPaymentsForUser(userId: string): Promise<PaymentRecord[]> {
  const rows = await prisma.payment.findMany({
    where: { userId, status: 'CAPTURED' },
  });
  return rows.map(toPaymentRecord);
}

// The input computeAccessWindow needs for renewal stacking: the latest
// still-unexpired accessUntil for this user on this exact plan, or null if
// there is none (fresh purchase, or the user's current access is on a
// different plan — cross-plan access never stacks).
export async function getLatestUnexpiredAccessUntil(
  userId: string,
  plan: PaidPlan,
  now: Date,
): Promise<Date | null> {
  const row = await prisma.payment.findFirst({
    where: { userId, plan, status: 'CAPTURED', accessUntil: { gt: now } },
    orderBy: { accessUntil: 'desc' },
    select: { accessUntil: true },
  });
  return row?.accessUntil ?? null;
}

export async function getPaymentHistoryForUser(userId: string, limit = 20): Promise<PaymentRecord[]> {
  const rows = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(toPaymentRecord);
}

export async function countUserCapturedCouponRedemptions(userId: string, couponId: string): Promise<number> {
  return prisma.payment.count({ where: { userId, couponId, status: 'CAPTURED' } });
}
