import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { getServerEnv } from '../src/lib/env';
import { launchAmountFor, type PaidPlan } from '../src/lib/payments/config';
import { RazorpayClient } from '../src/lib/payments/razorpay-client';
import { createPendingPayment } from '../src/lib/payments/payment-store';

// Creates a real Razorpay test-mode order (and matching local Payment(CREATED)
// row) for manual Test Checkout method verification — the same store/client
// code POST /order uses, minus the Express/Clerk layer.
//
// Always creates a FRESH order. Reusing one order across several test
// attempts (a failed card, then netbanking, then UPI) works — Razorpay
// supports multiple attempts per order — but it also accumulates unrelated
// attempt history that makes a specific method's result harder to read back
// out via razorpay-inspect-order.ts. Prefer one order per method you're
// testing.
//
// Usage: npx tsx scripts/razorpay-test-order.ts [userId] [CORE|MAX]
async function main() {
  const [, , userIdArg, planArg] = process.argv;
  const userId = userIdArg || `test-order-user-${Date.now()}`;
  const plan = (planArg || 'CORE') as PaidPlan;

  const env = getServerEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET must be set locally to run this.');
  }

  await prisma.user.upsert({ where: { id: userId }, create: { id: userId, plan: 'FREE' }, update: {} });

  const client = new RazorpayClient({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET });
  const amount = launchAmountFor(plan);
  const receipt = `test-${plan.toLowerCase()}-${Date.now()}`;
  const order = await client.createOrder({ amount, currency: 'INR', receipt, notes: { userId, plan, source: 'manual-test' } });

  await createPendingPayment({ userId, plan, providerOrderId: order.id, amount, currency: 'INR' });

  console.log(JSON.stringify({ userId, plan, orderId: order.id, amount, keyId: env.RAZORPAY_KEY_ID }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
