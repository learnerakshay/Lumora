import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { createCoupon, findCouponByCode } from '../src/lib/payments/coupon-store';
import { isPaidPlan, PAID_PLANS, type PaidPlan } from '../src/lib/payments/config';

// Creates a coupon for a controlled real-money Live Mode smoke test (Phase
// 4 §9) or a launch promotion. Reuses createCoupon/coupon-store verbatim —
// Coupon.appliesToPlans is already a JSON array on both the schema and
// createCoupon's input type, so a single coupon applying to more than one
// plan is not a new capability; "ALL" below is only a CLI convenience for
// [...PAID_PLANS]. Does not touch pricing, Razorpay, or any frozen payment
// code — this only inserts a Coupon row via the existing coupon-store.
//
// Usage: npx tsx scripts/payments-create-coupon.ts <CODE> <CORE|MAX|ALL> [percentOff=100] [maxRedemptions] [perUserLimit=1] [validUntilDays]
//   percentOff       integer 1-100, default 100
//   maxRedemptions   positive integer, default unlimited (null)
//   perUserLimit     positive integer, default 1
//   validUntilDays   positive integer; coupon expires this many days from now, default never
const USAGE =
  'Usage: npx tsx scripts/payments-create-coupon.ts <CODE> <CORE|MAX|ALL> [percentOff=100] [maxRedemptions] [perUserLimit=1] [validUntilDays]';

async function main() {
  const [, , codeArg, planArg, percentArg, maxRedemptionsArg, perUserLimitArg, validUntilDaysArg] = process.argv;
  if (!codeArg || !planArg) {
    throw new Error(USAGE);
  }

  let appliesToPlans: PaidPlan[];
  if (planArg.toUpperCase() === 'ALL') {
    appliesToPlans = [...PAID_PLANS];
  } else if (isPaidPlan(planArg)) {
    appliesToPlans = [planArg];
  } else {
    throw new Error(`Plan must be CORE, MAX, or ALL, got "${planArg}"`);
  }

  const percentOff = percentArg ? Number(percentArg) : 100;
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) {
    throw new Error(`percentOff must be an integer between 1 and 100, got "${percentArg}"`);
  }

  const maxRedemptions = maxRedemptionsArg ? Number(maxRedemptionsArg) : null;
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
    throw new Error(`maxRedemptions must be a positive integer, got "${maxRedemptionsArg}"`);
  }

  const perUserLimit = perUserLimitArg ? Number(perUserLimitArg) : 1;
  if (!Number.isInteger(perUserLimit) || perUserLimit < 1) {
    throw new Error(`perUserLimit must be a positive integer, got "${perUserLimitArg}"`);
  }

  let validUntil: Date | null = null;
  if (validUntilDaysArg) {
    const days = Number(validUntilDaysArg);
    if (!Number.isInteger(days) || days < 1) {
      throw new Error(`validUntilDays must be a positive integer, got "${validUntilDaysArg}"`);
    }
    validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const existing = await findCouponByCode(codeArg);
  if (existing) {
    throw new Error(`Coupon "${codeArg}" already exists (id: ${existing.id}) — use a different code.`);
  }

  const coupon = await createCoupon({
    code: codeArg,
    kind: 'PERCENT',
    value: percentOff,
    appliesToPlans,
    maxRedemptions,
    perUserLimit,
    validUntil,
  });

  console.log(JSON.stringify(coupon, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
