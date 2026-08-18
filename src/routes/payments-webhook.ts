import { Router } from 'express';
import { getServerEnv } from '../lib/env';
import { logger } from '../lib/logger';
import { processWebhookEvent } from '../lib/payments/webhook-handler';

export const paymentsWebhookRouter = Router();

// No requireApiAuth: Razorpay is the caller, not a signed-in Lumora user.
// Trust is established entirely by the HMAC signature check inside
// processWebhookEvent, over the raw body this route receives verbatim
// (see server.ts — this router must be mounted with express.raw() BEFORE
// express.json()).
paymentsWebhookRouter.post('/', async (req, res) => {
  const env = getServerEnv();
  if (!env.PAYMENTS_ENABLED || !env.RAZORPAY_WEBHOOK_SECRET) {
    // Payments aren't live yet — never attempt to verify or store an event
    // against a secret that isn't actually configured.
    res.status(503).end();
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    // Structurally shouldn't happen given the express.raw() mount in
    // server.ts, but if it ever isn't a Buffer we must fail loudly rather
    // than silently hashing/verifying something that isn't the real body.
    logger.error('Webhook route received a non-Buffer body — raw body middleware misconfigured', undefined);
    res.status(500).end();
    return;
  }

  const outcome = await processWebhookEvent({
    rawBody: req.body,
    signatureHeader: req.header('x-razorpay-signature'),
    eventIdHeader: req.header('x-razorpay-event-id'),
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  });

  if (outcome.status === 'SIGNATURE_INVALID') {
    logger.warn('Webhook signature verification failed');
    res.status(400).end();
    return;
  }

  if (outcome.status === 'PROCESSING_FAILED') {
    logger.error('Webhook event recorded but processing failed', undefined, {
      eventType: outcome.eventType,
      errorMessage: outcome.errorMessage,
    });
  }

  // Every other outcome (duplicate, ignored, processed, or a processing
  // failure after a verified signature) returns 200. Razorpay retries on
  // anything else, and retrying a signature-valid event we've already
  // recorded just re-enters the same idempotent path — the stored
  // WebhookEvent row plus POST /access/refresh is the real recovery
  // mechanism, not a retry storm.
  res.status(200).end();
});
