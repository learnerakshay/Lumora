import 'dotenv/config';
import { getServerEnv } from '../src/lib/env';
import { RazorpayClient } from '../src/lib/payments/razorpay-client';

// Dumps the raw Razorpay Order + every Payment attempt against it, including
// fields our narrow RazorpayPayment type doesn't declare (error_source,
// error_step, error_reason, bank, card, vpa, international, ...) — Node's
// runtime objects retain every field Razorpay actually returned regardless
// of what the TS interface names, so JSON.stringify still shows it all.
//
// Usage:
//   npx tsx scripts/razorpay-inspect-order.ts <order_id>   # one order
//   npx tsx scripts/razorpay-inspect-order.ts              # 20 most recent
async function main() {
  const [, , orderIdArg] = process.argv;
  const env = getServerEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET must be set locally to run this.');
  }
  const client = new RazorpayClient({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET });

  const orders = orderIdArg ? [await client.fetchOrder(orderIdArg)] : (await client.listOrders({ count: 20 })).items;
  console.log(`Inspecting ${orders.length} order(s).\n`);

  for (const order of orders) {
    console.log('='.repeat(80));
    console.log('ORDER', JSON.stringify(order, null, 2));
    const payments = await client.fetchOrderPayments(order.id);
    if (payments.items.length === 0) {
      console.log('  -> no payment attempts recorded on this order');
    }
    for (const payment of payments.items) {
      console.log('  PAYMENT', JSON.stringify(payment, null, 2));
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
