import type { PaidPlan } from './config';
import { MIN_ORDER_AMOUNT_PAISE } from './config';
import type { CouponKind } from './types';

export interface CouponRecord {
  id: string;
  code: string;
  kind: CouponKind;
  value: number; // PERCENT: 1-100 | FIXED: paise
  appliesToPlans: readonly PaidPlan[];
  maxRedemptions: number | null;
  redemptionCount: number;
  perUserLimit: number;
  validUntil: Date | null;
  active: boolean;
}

export type CouponValidationErrorCode =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_EXPIRED'
  | 'COUPON_NOT_APPLICABLE_TO_PLAN'
  | 'COUPON_LIMIT_REACHED'
  | 'COUPON_ALREADY_USED';

export type CouponValidationResult =
  | { valid: true; discountAmount: number; finalAmount: number }
  | { valid: false; code: CouponValidationErrorCode; message: string };

// Normalizes a user-entered coupon code for both storage and lookup, so
// "launch50", " LAUNCH50 ", and "LAUNCH50" are always the same coupon.
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

// Computes the raw discount for a coupon against a pre-discount amount.
// Does NOT clamp against MIN_ORDER_AMOUNT_PAISE — that clamp happens once,
// in validateCoupon, against the actual order amount.
export function applyDiscount(input: { kind: CouponKind; value: number; amount: number }): number {
  if (input.kind === 'PERCENT') {
    const percent = Math.min(Math.max(input.value, 0), 100);
    return Math.round((input.amount * percent) / 100);
  }
  return Math.min(Math.max(input.value, 0), input.amount);
}

// Server-authoritative coupon validation + discount resolution. The client
// only ever sends a coupon code; this function (and only this function)
// decides the amount actually charged. userCapturedRedemptions must be the
// caller-resolved count of this user's CAPTURED payments against this coupon
// (across first purchases and renewals alike — a coupon does not distinguish
// between them).
export function validateCoupon(input: {
  coupon: CouponRecord | null;
  plan: PaidPlan;
  amount: number; // paise, pre-discount
  userCapturedRedemptions: number;
  now: Date;
}): CouponValidationResult {
  const { coupon, plan, amount, userCapturedRedemptions, now } = input;

  if (!coupon) {
    return { valid: false, code: 'COUPON_NOT_FOUND', message: 'This coupon code was not found.' };
  }
  if (!coupon.active) {
    return { valid: false, code: 'COUPON_INACTIVE', message: 'This coupon is no longer active.' };
  }
  if (coupon.validUntil && coupon.validUntil.getTime() < now.getTime()) {
    return { valid: false, code: 'COUPON_EXPIRED', message: 'This coupon has expired.' };
  }
  if (!coupon.appliesToPlans.includes(plan)) {
    return {
      valid: false,
      code: 'COUPON_NOT_APPLICABLE_TO_PLAN',
      message: `This coupon cannot be applied to the ${plan} plan.`,
    };
  }
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return { valid: false, code: 'COUPON_LIMIT_REACHED', message: 'This coupon has reached its redemption limit.' };
  }
  if (userCapturedRedemptions >= coupon.perUserLimit) {
    return { valid: false, code: 'COUPON_ALREADY_USED', message: 'You have already used this coupon.' };
  }

  const rawDiscount = applyDiscount({ kind: coupon.kind, value: coupon.value, amount });
  // Clamp so the final charge never drops below Razorpay's minimum order
  // amount — a 100%-off (or larger) coupon still produces a chargeable ₹1
  // order rather than an invalid ₹0 one.
  const finalAmount = Math.max(amount - rawDiscount, MIN_ORDER_AMOUNT_PAISE);
  const discountAmount = amount - finalAmount;

  return { valid: true, discountAmount, finalAmount };
}
