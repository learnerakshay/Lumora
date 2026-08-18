import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { processWebhookEvent, type WebhookHandlerDeps } from './webhook-handler';
import type { RecordWebhookEventResult } from './webhook-store';
import type { CaptureResult } from './capture-service';
import type { PaymentRecord } from './payment-store';

const WEBHOOK_SECRET = 'whsec_test';

function sign(rawBody: Buffer): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

function buildBody(payload: Record<string, unknown>): Buffer {
  return Buffer.from(JSON.stringify(payload));
}

interface DepsCallLog {
  recordWebhookEvent: Array<Parameters<WebhookHandlerDeps['recordWebhookEvent']>[0]>;
  markWebhookEventProcessed: Array<Parameters<WebhookHandlerDeps['markWebhookEventProcessed']>>;
  capturePayment: Array<Parameters<WebhookHandlerDeps['capturePayment']>[0]>;
  markPaymentFailed: Array<Parameters<WebhookHandlerDeps['markPaymentFailed']>>;
}

function makeDeps(overrides: Partial<WebhookHandlerDeps> = {}): { deps: WebhookHandlerDeps; calls: DepsCallLog } {
  const calls: DepsCallLog = {
    recordWebhookEvent: [],
    markWebhookEventProcessed: [],
    capturePayment: [],
    markPaymentFailed: [],
  };
  const fakePaymentRecord = {} as PaymentRecord;
  const deps: WebhookHandlerDeps = {
    recordWebhookEvent: async (input) => {
      calls.recordWebhookEvent.push(input);
      const result: RecordWebhookEventResult = {
        inserted: true,
        event: {
          id: 'evtrow_1',
          eventId: input.eventId,
          eventType: input.eventType,
          processed: false,
          errorMessage: null,
          receivedAt: new Date().toISOString(),
          processedAt: null,
        },
      };
      return result;
    },
    markWebhookEventProcessed: async (...args) => {
      calls.markWebhookEventProcessed.push(args);
    },
    capturePayment: async (input) => {
      calls.capturePayment.push(input);
      const result: CaptureResult = { captured: true, entitlement: { changed: true, plan: 'CORE', planExpiresAt: null } };
      return result;
    },
    markPaymentFailed: async (...args) => {
      calls.markPaymentFailed.push(args);
      return fakePaymentRecord;
    },
    ...overrides,
  };
  return { deps, calls };
}

test('an invalid signature is rejected before touching any store or capture logic', async () => {
  const { deps, calls } = makeDeps();
  const rawBody = buildBody({ event: 'payment.captured', payload: {} });
  const outcome = await processWebhookEvent(
    { rawBody, signatureHeader: 'not-the-real-signature', eventIdHeader: 'evt_1', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.deepEqual(outcome, { status: 'SIGNATURE_INVALID' });
  assert.equal(calls.recordWebhookEvent.length, 0);
  assert.equal(calls.capturePayment.length, 0);
});

test('a duplicate eventId short-circuits to DUPLICATE without reprocessing', async () => {
  const { deps, calls } = makeDeps({
    recordWebhookEvent: async (input) => {
      calls.recordWebhookEvent.push(input);
      return { inserted: false };
    },
  });
  const rawBody = buildBody({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', method: 'upi' } } },
  });
  const outcome = await processWebhookEvent(
    { rawBody, signatureHeader: sign(rawBody), eventIdHeader: 'evt_dup', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.deepEqual(outcome, { status: 'DUPLICATE' });
  assert.equal(calls.recordWebhookEvent.length, 1);
  assert.equal(calls.capturePayment.length, 0);
  assert.equal(calls.markWebhookEventProcessed.length, 0);
});

test('an unrecognized event type is recorded, marked processed, and ignored', async () => {
  const { deps, calls } = makeDeps();
  const rawBody = buildBody({ event: 'refund.processed', payload: {} });
  const outcome = await processWebhookEvent(
    { rawBody, signatureHeader: sign(rawBody), eventIdHeader: 'evt_2', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.deepEqual(outcome, { status: 'IGNORED', eventType: 'refund.processed' });
  assert.equal(calls.markWebhookEventProcessed.length, 1);
  assert.deepEqual(calls.markWebhookEventProcessed[0], ['evtrow_1', null]);
  assert.equal(calls.capturePayment.length, 0);
});

test('payment.captured dispatches to capturePayment with the correct fields and WEBHOOK_PAYMENT_CAPTURED reason', async () => {
  const { deps, calls } = makeDeps();
  const rawBody = buildBody({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', method: 'card' } } },
  });
  const outcome = await processWebhookEvent(
    { rawBody, signatureHeader: sign(rawBody), eventIdHeader: 'evt_3', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.deepEqual(outcome, { status: 'PROCESSED', eventType: 'payment.captured' });
  assert.equal(calls.capturePayment.length, 1);
  assert.deepEqual(calls.capturePayment[0], {
    providerOrderId: 'order_1',
    providerPaymentId: 'pay_1',
    method: 'card',
    signatureVerified: true,
    reason: 'WEBHOOK_PAYMENT_CAPTURED',
  });
  assert.deepEqual(calls.markWebhookEventProcessed[0], ['evtrow_1', null]);
});

test('order.paid dispatches to capturePayment with WEBHOOK_ORDER_PAID (a distinct reason from payment.captured)', async () => {
  const { deps, calls } = makeDeps();
  const rawBody = buildBody({
    event: 'order.paid',
    payload: { payment: { entity: { id: 'pay_2', order_id: 'order_2', method: 'upi' } } },
  });
  const outcome = await processWebhookEvent(
    { rawBody, signatureHeader: sign(rawBody), eventIdHeader: 'evt_4', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.deepEqual(outcome, { status: 'PROCESSED', eventType: 'order.paid' });
  assert.equal(calls.capturePayment[0].reason, 'WEBHOOK_ORDER_PAID');
});

// Regression for the double-grant risk: Razorpay can send BOTH order.paid and
// payment.captured for the same payment under different eventIds. Structural
// idempotency here relies on capturePayment's own CREATED->CAPTURED guard
// (tested in capture-service), not on this handler deduplicating by event
// type — so this test only asserts the handler calls capturePayment once per
// distinct webhook delivery, exactly as designed.
test('two different events for the same order both reach capturePayment once each, relying on capturePayment for the actual grant idempotency', async () => {
  const { deps, calls } = makeDeps();
  const capturedBody = buildBody({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_3', order_id: 'order_3', method: 'upi' } } },
  });
  const paidBody = buildBody({
    event: 'order.paid',
    payload: { payment: { entity: { id: 'pay_3', order_id: 'order_3', method: 'upi' } } },
  });
  await processWebhookEvent(
    { rawBody: capturedBody, signatureHeader: sign(capturedBody), eventIdHeader: 'evt_5a', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  await processWebhookEvent(
    { rawBody: paidBody, signatureHeader: sign(paidBody), eventIdHeader: 'evt_5b', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.equal(calls.capturePayment.length, 2);
  assert.equal(calls.capturePayment[0].providerOrderId, 'order_3');
  assert.equal(calls.capturePayment[1].providerOrderId, 'order_3');
});

test('payment.failed records the failure reason and never calls capturePayment', async () => {
  const { deps, calls } = makeDeps();
  const rawBody = buildBody({
    event: 'payment.failed',
    payload: {
      payment: {
        entity: { id: 'pay_4', order_id: 'order_4', error_code: 'BAD_REQUEST_ERROR', error_description: 'Card declined' },
      },
    },
  });
  const outcome = await processWebhookEvent(
    { rawBody, signatureHeader: sign(rawBody), eventIdHeader: 'evt_6', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.deepEqual(outcome, { status: 'PROCESSED', eventType: 'payment.failed' });
  assert.equal(calls.capturePayment.length, 0);
  assert.equal(calls.markPaymentFailed.length, 1);
  assert.deepEqual(calls.markPaymentFailed[0], [
    'order_4',
    { providerPaymentId: 'pay_4', failureCode: 'BAD_REQUEST_ERROR', failureReason: 'Card declined' },
  ]);
});

test('a missing event-id header falls back to a deterministic id and still records the event', async () => {
  const { deps, calls } = makeDeps();
  const rawBody = buildBody({ event: 'refund.processed', payload: {} });
  await processWebhookEvent(
    { rawBody, signatureHeader: sign(rawBody), eventIdHeader: undefined, webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.equal(calls.recordWebhookEvent.length, 1);
  assert.match(calls.recordWebhookEvent[0].eventId, /^fallback:refund\.processed:[0-9a-f]{16}$/);
});

test('a malformed payload entity for payment.captured is a processing failure, not a thrown exception, and the route still gets a resolvable outcome', async () => {
  const { deps, calls } = makeDeps();
  const rawBody = buildBody({ event: 'payment.captured', payload: { payment: { entity: {} } } });
  const outcome = await processWebhookEvent(
    { rawBody, signatureHeader: sign(rawBody), eventIdHeader: 'evt_7', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.equal(outcome.status, 'PROCESSING_FAILED');
  if (outcome.status === 'PROCESSING_FAILED') {
    assert.match(outcome.errorMessage, /missing payment entity/);
  }
  assert.equal(calls.markWebhookEventProcessed.length, 1);
  assert.equal(calls.markWebhookEventProcessed[0][0], 'evtrow_1');
  assert.match(String(calls.markWebhookEventProcessed[0][1]), /missing payment entity/);
});

test('a capturePayment failure inside the try block still resolves PROCESSING_FAILED rather than rejecting', async () => {
  const { deps, calls } = makeDeps({
    capturePayment: async (input) => {
      calls.capturePayment.push(input);
      throw new Error('database unavailable');
    },
  });
  const rawBody = buildBody({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_5', order_id: 'order_5', method: 'upi' } } },
  });
  const outcome = await processWebhookEvent(
    { rawBody, signatureHeader: sign(rawBody), eventIdHeader: 'evt_8', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.equal(outcome.status, 'PROCESSING_FAILED');
  if (outcome.status === 'PROCESSING_FAILED') {
    assert.equal(outcome.errorMessage, 'database unavailable');
  }
});

test('an unparseable (but signature-valid) body is ignored rather than throwing', async () => {
  const rawBody = Buffer.from('not json{{{');
  const { deps, calls } = makeDeps();
  const outcome = await processWebhookEvent(
    { rawBody, signatureHeader: sign(rawBody), eventIdHeader: 'evt_9', webhookSecret: WEBHOOK_SECRET },
    deps,
  );
  assert.deepEqual(outcome, { status: 'IGNORED', eventType: 'unparseable' });
  assert.equal(calls.recordWebhookEvent.length, 0);
});
