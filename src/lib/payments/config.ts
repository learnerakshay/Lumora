export const PAID_PLANS = ['CORE', 'MAX'] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(plan: string): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan);
}

export const PLAN_ACCESS_DAYS_DEFAULT = 30;

export const PAYMENTS_CURRENCY_DEFAULT = 'INR';

// Amounts are integer paise (INR minor units), never Float. "list" is the
// struck-through reference price; "launch" is what is actually charged.
// Treat this as real launch pricing, not a permanent fake discount.
export const PLAN_PRICING_PAISE: Record<PaidPlan, { listAmount: number; launchAmount: number }> = {
  CORE: { listAmount: 99_900, launchAmount: 49_900 },
  MAX: { listAmount: 249_900, launchAmount: 149_900 },
};

export function launchAmountFor(plan: PaidPlan): number {
  return PLAN_PRICING_PAISE[plan].launchAmount;
}

export function listAmountFor(plan: PaidPlan): number {
  return PLAN_PRICING_PAISE[plan].listAmount;
}

// Razorpay's minimum chargeable order amount is ₹1. A coupon can never drive
// the final charge below this — see coupon.ts.
export const MIN_ORDER_AMOUNT_PAISE = 100;
