import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { createCoupon, findCouponByCode } from '../src/lib/payments/coupon-store';
import { isPaidPlan, type PaidPlan } from '../src/lib/payments/config';

// Creates a single-use coupon for the controlled real-money Live Mode smoke
// test (Phase 4 §9): a 100%-off, maxRedemptions: 1, perUserLimit: 1 coupon
// against CORE, which validateCoupon's MIN_ORDER_AMOUNT_PAISE clamp turns
// into a real ₹1 chargeable order rather than a ₹0 one Razorpay would
// reject. Does not touch pricing, Razorpay, or any frozen payment code —
// this only inserts a Coupon row via the existing coupon-store.
//
// Usage: npx tsx scripts/payments-create-coupon.ts <CODE> <CORE|MAX> [percentOff=100]
async function main() {
  const [, , codeArg, planArg, percentArg] = process.argv;
  if (!codeArg || !planArg) {
    throw new Error('Usage: npx tsx scripts/payments-create-coupon.ts <CODE> <CORE|MAX> [percentOff=100]');
  }
  if (!isPaidPlan(planArg)) {
    throw new Error(`Plan must be CORE or MAX, got "${planArg}"`);
  }
  const plan: PaidPlan = planArg;
  const percentOff = percentArg ? Number(percentArg) : 100;
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) {
    throw new Error(`percentOff must be an integer between 1 and 100, got "${percentArg}"`);
  }

  const existing = await findCouponByCode(codeArg);
  if (existing) {
    throw new Error(`Coupon "${codeArg}" already exists (id: ${existing.id}) — use a different code.`);
  }

  const coupon = await createCoupon({
    code: codeArg,
    kind: 'PERCENT',
    value: percentOff,
    appliesToPlans: [plan],
    maxRedemptions: 1,
    perUserLimit: 1,
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
