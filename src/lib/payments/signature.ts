import { createHmac, timingSafeEqual } from 'node:crypto';

const HEX_PATTERN = /^[0-9a-f]+$/i;

function computeHmacHex(payload: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// timingSafeEqual throws on a length mismatch instead of returning false.
// An uncaught throw here would turn a forged/garbled signature into a 500,
// and for the webhook route that means Razorpay retries the same forged
// request forever. Every comparison must go through this guard.
function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  if (!actualHex || !HEX_PATTERN.test(actualHex) || actualHex.length !== expectedHex.length) {
    return false;
  }
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// Razorpay Orders checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret).
// Note the operand order — this is the reverse of the (now-unused) Subscriptions
// formula, which was payment_id + "|" + subscription_id. Getting this backwards
// is the classic Razorpay integration bug.
export function verifyOrderSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  if (!input.orderId || !input.paymentId || !input.keySecret) return false;
  const expectedHex = computeHmacHex(`${input.orderId}|${input.paymentId}`, input.keySecret);
  return timingSafeEqualHex(expectedHex, input.signature);
}

// Webhook signature: HMAC_SHA256(rawRequestBody, webhook_secret). This MUST be
// computed over the exact raw bytes Razorpay sent — never over a
// JSON.stringify() of a parsed body, which is not guaranteed byte-identical
// (key order, whitespace, unicode escaping). The caller is responsible for
// getting the raw Buffer to this function (see server.ts webhook mount, Phase 2).
export function verifyWebhookSignature(input: {
  rawBody: Buffer | string;
  signature: string;
  webhookSecret: string;
}): boolean {
  if (!input.webhookSecret) return false;
  const expectedHex = computeHmacHex(input.rawBody, input.webhookSecret);
  return timingSafeEqualHex(expectedHex, input.signature);
}
