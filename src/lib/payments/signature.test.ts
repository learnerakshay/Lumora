import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyOrderSignature, verifyWebhookSignature } from './signature';

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

function sign(payload: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

test('verifyOrderSignature accepts a correctly-signed order_id|payment_id payload', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';
  const signature = sign(`${orderId}|${paymentId}`, KEY_SECRET);
  assert.equal(
    verifyOrderSignature({ orderId, paymentId, signature, keySecret: KEY_SECRET }),
    true,
  );
});

// The classic Razorpay integration bug: the Subscriptions formula is
// payment_id|subscription_id (reversed). Orders must not accept that order.
test('verifyOrderSignature rejects the reversed (payment|order) operand order', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';
  const reversedSignature = sign(`${paymentId}|${orderId}`, KEY_SECRET);
  assert.equal(
    verifyOrderSignature({ orderId, paymentId, signature: reversedSignature, keySecret: KEY_SECRET }),
    false,
  );
});

test('verifyOrderSignature rejects a tampered order id', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';
  const signature = sign(`${orderId}|${paymentId}`, KEY_SECRET);
  assert.equal(
    verifyOrderSignature({ orderId: 'order_TAMPERED', paymentId, signature, keySecret: KEY_SECRET }),
    false,
  );
});

test('verifyOrderSignature rejects the correct signature under the wrong secret', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';
  const signature = sign(`${orderId}|${paymentId}`, 'wrong_secret');
  assert.equal(
    verifyOrderSignature({ orderId, paymentId, signature, keySecret: KEY_SECRET }),
    false,
  );
});

test('verifyOrderSignature rejects a wrong-length hex signature without throwing', () => {
  assert.doesNotThrow(() => {
    const result = verifyOrderSignature({
      orderId: 'order_ABC123',
      paymentId: 'pay_XYZ789',
      signature: 'abcd', // valid hex, wrong length — must not reach timingSafeEqual's throw path
      keySecret: KEY_SECRET,
    });
    assert.equal(result, false);
  });
});

test('verifyOrderSignature rejects non-hex garbage without throwing', () => {
  assert.doesNotThrow(() => {
    const result = verifyOrderSignature({
      orderId: 'order_ABC123',
      paymentId: 'pay_XYZ789',
      signature: 'not-hex-at-all!!',
      keySecret: KEY_SECRET,
    });
    assert.equal(result, false);
  });
});

test('verifyOrderSignature rejects an empty signature', () => {
  assert.equal(
    verifyOrderSignature({ orderId: 'order_ABC123', paymentId: 'pay_XYZ789', signature: '', keySecret: KEY_SECRET }),
    false,
  );
});

test('verifyOrderSignature rejects when orderId or paymentId is missing', () => {
  assert.equal(
    verifyOrderSignature({ orderId: '', paymentId: 'pay_XYZ789', signature: 'aa', keySecret: KEY_SECRET }),
    false,
  );
  assert.equal(
    verifyOrderSignature({ orderId: 'order_ABC123', paymentId: '', signature: 'aa', keySecret: KEY_SECRET }),
    false,
  );
});

test('verifyWebhookSignature accepts a correctly-signed raw body Buffer', () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { id: 'pay_1' } }));
  const signature = sign(rawBody, WEBHOOK_SECRET);
  assert.equal(
    verifyWebhookSignature({ rawBody, signature, webhookSecret: WEBHOOK_SECRET }),
    true,
  );
});

test('verifyWebhookSignature rejects a body byte tampered after signing', () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
  const signature = sign(rawBody, WEBHOOK_SECRET);
  const tamperedBody = Buffer.from(JSON.stringify({ event: 'payment.captured ' })); // trailing space
  assert.equal(
    verifyWebhookSignature({ rawBody: tamperedBody, signature, webhookSecret: WEBHOOK_SECRET }),
    false,
  );
});

test('verifyWebhookSignature rejects the correct signature under the wrong secret', () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
  const signature = sign(rawBody, 'wrong_secret');
  assert.equal(
    verifyWebhookSignature({ rawBody, signature, webhookSecret: WEBHOOK_SECRET }),
    false,
  );
});

test('verifyWebhookSignature rejects an empty body', () => {
  const rawBody = Buffer.from('');
  const signature = sign(rawBody, WEBHOOK_SECRET);
  assert.equal(
    verifyWebhookSignature({ rawBody, signature, webhookSecret: WEBHOOK_SECRET }),
    true, // a correctly-signed empty body is still a valid signature check
  );
  assert.equal(
    verifyWebhookSignature({ rawBody, signature: '', webhookSecret: WEBHOOK_SECRET }),
    false,
  );
});

test('verifyWebhookSignature rejects when the webhook secret is missing', () => {
  const rawBody = Buffer.from('{}');
  assert.equal(
    verifyWebhookSignature({ rawBody, signature: 'aa', webhookSecret: '' }),
    false,
  );
});
