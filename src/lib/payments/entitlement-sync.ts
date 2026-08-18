import { prisma } from '../prisma';
import { logger } from '../logger';
import type { PlanName } from '../usage/config';
import { resolveEntitledPlan, type EntitlingPayment } from './access';

export type EntitlementSyncReason =
  | 'PAYMENT_VERIFIED'
  | 'WEBHOOK_PAYMENT_CAPTURED'
  | 'WEBHOOK_ORDER_PAID'
  | 'ACCESS_REFRESH'
  | 'ACCESS_EXPIRED';

export interface EntitlementSyncResult {
  changed: boolean;
  plan: PlanName;
  planExpiresAt: Date | null;
}

// The ONLY function in the codebase that writes User.plan. Reuses the same
// pg_advisory_xact_lock(hashtext(userId)) pattern as usage/service.ts's
// checkAndReserve, so a plan change can never interleave with a usage-limit
// check on the same user. Always re-derives from every CAPTURED payment
// row (never trusts a delta), so it is naturally idempotent — calling it
// twice for the same state is a no-op.
export async function syncUserEntitlement(
  userId: string,
  reason: EntitlementSyncReason,
  now: Date = new Date(),
): Promise<EntitlementSyncResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const rows = await tx.payment.findMany({
      where: { userId, status: 'CAPTURED' },
      select: { plan: true, status: true, accessUntil: true },
    });
    const entitlingPayments: EntitlingPayment[] = rows.map((row) => ({
      plan: row.plan as PlanName,
      status: row.status as EntitlingPayment['status'],
      accessUntil: row.accessUntil,
    }));
    const resolved = resolveEntitledPlan(entitlingPayments, now);

    const user = await tx.user.upsert({
      where: { id: userId },
      create: { id: userId },
      update: {},
      select: { plan: true },
    });

    const changed = user.plan !== resolved.plan;
    await tx.user.update({
      where: { id: userId },
      data: {
        plan: resolved.plan,
        planExpiresAt: resolved.planExpiresAt,
        planUpdatedAt: now,
      },
    });

    if (changed) {
      logger.info('Entitlement changed', {
        userId,
        from: user.plan,
        to: resolved.plan,
        reason,
      });
    }

    return { changed, plan: resolved.plan, planExpiresAt: resolved.planExpiresAt };
  });
}
