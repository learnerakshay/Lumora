import { createHash } from 'node:crypto';
import { logger } from '../logger';
import { capturePayment as capturePaymentDefault } from './capture-service';
import { markPaymentFailed as markPaymentFailedDefault } from './payment-store';
import { verifyWebhookSignature } from './signature';
import {
  markWebhookEventProcessed as markWebhookEventProcessedDefault,
  recordWebhookEvent as recordWebhookEventDefault,
} from './webhook-store';

export interface WebhookHandlerDeps {
  recordWebhookEvent: typeof recordWebhookEventDefault;
  markWebhookEventProcessed: typeof markWebhookEventProcessedDefault;
  capturePayment: typeof capturePaymentDefault;
  markPaymentFailed: typeof markPaymentFailedDefault;
}

const defaultDeps: WebhookHandlerDeps = {
  recordWebhookEvent: recordWebhookEventDefault,
  markWebhookEventProcessed: markWebhookEventProcessedDefault,
  capturePayment: capturePaymentDefault,
  markPaymentFailed: markPaymentFailedDefault,
};

export type WebhookHandlerOutcome =
  | { status: 'SIGNATURE_INVALID' }
  | { status: 'DUPLICATE' }
  | { status: 'IGNORED'; eventType: string }
  | { status: 'PROCESSED'; eventType: string }
  | { status: 'PROCESSING_FAILED'; eventType: string; errorMessage: string };

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
}

// The only three events this one-time-payment flow needs. Everything else
// (refund.*, order.notification, etc.) is recorded for the idempotency
// ledger but otherwise ignored.
const HANDLED_EVENT_TYPES = new Set(['payment.captured', 'payment.failed', 'order.paid']);

function fallbackEventId(eventType: string, rawBody: Buffer): string {
  // Razorpay always sends x-razorpay-event-id in practice; this only exists
  // so a missing header degrades to "dedupe by exact payload" instead of
  // silently skipping the idempotency ledger.
  return `fallback:${eventType}:${createHash('sha256').update(rawBody).digest('hex').slice(0, 16)}`;
}

// Verifies the webhook signature over the exact raw bytes, records it in the
// idempotency ledger (a duplicate delivery short-circuits here), then
// dispatches to the shared capture/failure routines. ALWAYS resolves rather
// than throwing for any signature-verified event — the caller (the route)
// is responsible for turning PROCESSING_FAILED into a 200 anyway, since a
// 5xx here would just make Razorpay retry the same event into the same
// failure on a possibly cold instance. Only SIGNATURE_INVALID should ever
// become a non-200 response.
export async function processWebhookEvent(
  input: {
    rawBody: Buffer;
    signatureHeader: string | undefined;
    eventIdHeader: string | undefined;
    webhookSecret: string;
  },
  deps: WebhookHandlerDeps = defaultDeps,
): Promise<WebhookHandlerOutcome> {
  const signatureValid = verifyWebhookSignature({
    rawBody: input.rawBody,
    signature: input.signatureHeader || '',
    webhookSecret: input.webhookSecret,
  });
  if (!signatureValid) {
    return { status: 'SIGNATURE_INVALID' };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(input.rawBody.toString('utf8'));
  } catch {
    // A verified-but-unparseable body should never happen from Razorpay;
    // treat it as an unrecognized event rather than crashing the handler.
    return { status: 'IGNORED', eventType: 'unparseable' };
  }

  const eventType = typeof payload.event === 'string' ? payload.event : 'unknown';
  const eventId = input.eventIdHeader || fallbackEventId(eventType, input.rawBody);
  const providerCreatedAt =
    typeof payload.created_at === 'number' ? new Date(payload.created_at * 1000) : null;

  const recordResult = await deps.recordWebhookEvent({ eventId, eventType, providerCreatedAt, payload });
  if (!recordResult.inserted) {
    return { status: 'DUPLICATE' };
  }
  const eventRecordId = recordResult.event.id;

  if (!HANDLED_EVENT_TYPES.has(eventType)) {
    await deps.markWebhookEventProcessed(eventRecordId, null);
    return { status: 'IGNORED', eventType };
  }

  try {
    const payloadPayment = payload.payload as { payment?: { entity?: RazorpayPaymentEntity } } | undefined;
    const entity = payloadPayment?.payment?.entity;

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      if (!entity?.order_id || !entity?.id) {
        throw new Error(`Webhook ${eventType} payload missing payment entity order_id/id`);
      }
      await deps.capturePayment({
        providerOrderId: entity.order_id,
        providerPaymentId: entity.id,
        method: entity.method ?? null,
        signatureVerified: true,
        reason: eventType === 'payment.captured' ? 'WEBHOOK_PAYMENT_CAPTURED' : 'WEBHOOK_ORDER_PAID',
      });
    } else if (eventType === 'payment.failed') {
      if (!entity?.order_id) {
        throw new Error('Webhook payment.failed payload missing payment entity order_id');
      }
      const updated = await deps.markPaymentFailed(entity.order_id, {
        providerPaymentId: entity.id ?? null,
        failureCode: entity.error_code ?? null,
        failureReason: entity.error_description ?? null,
      });
      if (!updated) {
        // Not an error (the webhook is still signature-verified and real) —
        // just an order with no matching local Payment row, e.g. a stale
        // test order. Nothing to update; log it so it's visible rather than
        // silently vanishing, matching capturePayment's handling of the
        // same "unknown order" case.
        logger.warn('payment.failed webhook for an order with no local Payment row', {
          providerOrderId: entity.order_id,
        });
      }
    }

    await deps.markWebhookEventProcessed(eventRecordId, null);
    return { status: 'PROCESSED', eventType };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Webhook event processing failed', error, { eventType, eventId });
    await deps.markWebhookEventProcessed(eventRecordId, errorMessage).catch(() => {});
    return { status: 'PROCESSING_FAILED', eventType, errorMessage };
  }
}
