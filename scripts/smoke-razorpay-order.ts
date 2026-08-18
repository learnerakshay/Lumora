import 'dotenv/config';
import { getServerEnv } from '../src/lib/env';
import { launchAmountFor } from '../src/lib/payments/config';
import { RazorpayClient } from '../src/lib/payments/razorpay-client';

// One-off Phase 1 readiness check: create a real Razorpay test-mode order for
// the CORE plan and read it back, confirming amount/currency/status. Never
// logs RAZORPAY_KEY_SECRET — key_id is a public identifier, key_secret is not.
async function main() {
  const env = getServerEnv();

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must both be set in .env to run this check.');
  }
  if (!env.RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
    throw new Error(
      `RAZORPAY_KEY_ID does not have the expected test-mode prefix (rzp_test_): starts with "${env.RAZORPAY_KEY_ID.slice(0, 9)}...".`,
    );
  }
  console.log(`Key ID: ${env.RAZORPAY_KEY_ID} (rzp_test_ prefix confirmed)`);

  const client = new RazorpayClient({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET });

  const amount = launchAmountFor('CORE');
  const currency = 'INR';
  const receipt = `smoke-core-${Date.now()}`;

  console.log(`Creating CORE order: amount=${amount} currency=${currency} receipt=${receipt}`);
  const created = await client.createOrder({ amount, currency, receipt, notes: { purpose: 'phase1-smoke-check' } });
  console.log(`Order created: id=${created.id} status=${created.status}`);

  const fetched = await client.fetchOrder(created.id);
  console.log(`Order fetched back: id=${fetched.id} amount=${fetched.amount} currency=${fetched.currency} status=${fetched.status}`);

  const failures: string[] = [];
  if (!fetched.id.startsWith('order_')) failures.push(`id does not start with "order_" (got ${fetched.id})`);
  if (fetched.amount !== amount) failures.push(`amount mismatch: expected ${amount}, got ${fetched.amount}`);
  if (fetched.currency !== currency) failures.push(`currency mismatch: expected ${currency}, got ${fetched.currency}`);
  if (fetched.status !== 'created') failures.push(`status mismatch: expected "created", got "${fetched.status}"`);

  if (failures.length > 0) {
    throw new Error(`Smoke check FAILED:\n- ${failures.join('\n- ')}`);
  }

  console.log('PASS: Razorpay test-mode order create + fetch smoke check succeeded.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
