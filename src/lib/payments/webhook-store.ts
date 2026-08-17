import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export interface WebhookEventRecord {
  id: string;
  eventId: string;
  eventType: string;
  processed: boolean;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
}

function toWebhookEventRecord(row: {
  id: string;
  eventId: string;
  eventType: string;
  processed: boolean;
  errorMessage: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}): WebhookEventRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    eventType: row.eventType,
    processed: row.processed,
    errorMessage: row.errorMessage,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
  };
}

export type RecordWebhookEventResult =
  | { inserted: true; event: WebhookEventRecord }
  | { inserted: false };

// Insert-or-detect-duplicate on the unique eventId. This IS the webhook
// idempotency guarantee: Razorpay retries a webhook delivery for up to 24h,
// and a P2002 unique-constraint violation here means "already seen, do not
// process again" rather than an error.
export async function recordWebhookEvent(input: {
  eventId: string;
  eventType: string;
  providerCreatedAt?: Date | null;
  payload: unknown;
}): Promise<RecordWebhookEventResult> {
  try {
    const created = await prisma.webhookEvent.create({
      data: {
        eventId: input.eventId,
        eventType: input.eventType,
        providerCreatedAt: input.providerCreatedAt ?? null,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
    return { inserted: true, event: toWebhookEventRecord(created) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { inserted: false };
    }
    throw error;
  }
}

export async function markWebhookEventProcessed(id: string, errorMessage: string | null = null): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id },
    data: { processed: true, processedAt: new Date(), errorMessage },
  });
}
