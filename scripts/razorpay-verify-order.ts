import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { getServerEnv } from '../src/lib/env';
import { RazorpayClient } from '../src/lib/payments/razorpay-client';
import { verifyOrderSignature } from '../src/lib/payments/signature';
import { capturePayment } from '../src/lib/payments/capture-service';
import { getPaymentByOrderId } from '../src/lib/payments/payment-store';

// Mirrors POST /order/verify's exact logic (src/routes/payments.ts) for
// manual Test Checkout verification, minus the Express/Clerk layer:
// signature verify -> authoritative Razorpay re-read -> capturePayment.
// Use this after completing a manual test checkout with
// razorpay-test-order.ts, once you have the razorpay_payment_id and
// razorpay_signature the checkout callback returned.
//
// Usage: npx tsx scripts/razorpay-verify-order.ts <orderId> <paymentId> <signature>
async function main() {
  const [, , orderId, paymentId, signature] = process.argv;
  if (!orderId || !paymentId || !signature) {
    throw new Error('Usage: npx tsx scripts/razorpay-verify-order.ts <orderId> <paymentId> <signature>');
  }

  const env = getServerEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET must be set locally to run this.');
  }

  const payment = await getPaymentByOrderId(orderId);
  if (!payment) throw new Error(`No local Payment row for order ${orderId}`);

  const signatureValid = verifyOrderSignature({ orderId, paymentId, signature, keySecret: env.RAZORPAY_KEY_SECRET });
  console.log('signatureValid:', signatureValid);
  if (!signatureValid) throw new Error('Signature verification failed');

  const client = new RazorpayClient({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET });
  const providerPayment = await client.fetchPayment(paymentId);
  console.log('providerPayment:', JSON.stringify(providerPayment, null, 2));

  if (providerPayment.order_id !== orderId) throw new Error('order_id mismatch');
  if (providerPayment.status !== 'captured' && providerPayment.status !== 'authorized') {
    throw new Error(`Payment not complete: status=${providerPayment.status}`);
  }

  const result = await capturePayment({
    providerOrderId: orderId,
    providerPaymentId: paymentId,
    method: providerPayment.method ?? null,
    signatureVerified: true,
    reason: 'PAYMENT_VERIFIED',
  });

  console.log('capturePayment result:', JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
