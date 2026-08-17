import { prisma } from '../prisma';
import type { PaidPlan } from './config';
import { normalizeCouponCode, type CouponRecord } from './coupon';
import type { CouponKind } from './types';

function toCouponRecord(row: {
  id: string;
  code: string;
  kind: string;
  value: number;
  appliesToPlans: unknown;
  maxRedemptions: number | null;
  redemptionCount: number;
  perUserLimit: number;
  validUntil: Date | null;
  active: boolean;
}): CouponRecord {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind as CouponKind,
    value: row.value,
    appliesToPlans: (row.appliesToPlans as PaidPlan[]) ?? [],
    maxRedemptions: row.maxRedemptions,
    redemptionCount: row.redemptionCount,
    perUserLimit: row.perUserLimit,
    validUntil: row.validUntil,
    active: row.active,
  };
}

export async function findCouponByCode(code: string): Promise<CouponRecord | null> {
  const row = await prisma.coupon.findUnique({ where: { code: normalizeCouponCode(code) } });
  return row ? toCouponRecord(row) : null;
}

export async function createCoupon(input: {
  code: string;
  kind: CouponKind;
  value: number;
  appliesToPlans: PaidPlan[];
  maxRedemptions?: number | null;
  perUserLimit?: number;
  validUntil?: Date | null;
}): Promise<CouponRecord> {
  const created = await prisma.coupon.create({
    data: {
      code: normalizeCouponCode(input.code),
      kind: input.kind,
      value: input.value,
      appliesToPlans: input.appliesToPlans,
      maxRedemptions: input.maxRedemptions ?? null,
      perUserLimit: input.perUserLimit ?? 1,
      validUntil: input.validUntil ?? null,
    },
  });
  return toCouponRecord(created);
}

// Increments the global redemption counter. Must be called exactly once per
// CAPTURED payment, after capture is confirmed — never at validation time.
export async function incrementCouponRedemption(couponId: string): Promise<void> {
  await prisma.coupon.update({
    where: { id: couponId },
    data: { redemptionCount: { increment: 1 } },
  });
}
