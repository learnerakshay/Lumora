import type { PlanName } from '../usage/config';
import { PLAN_ACCESS_DAYS_DEFAULT } from './config';
import type { PaymentStatus, ResolvedEntitlement } from './types';

const PLAN_RANK: Record<PlanName, number> = { FREE: 0, CORE: 1, MAX: 2 };

export interface EntitlingPayment {
  plan: PlanName;
  status: PaymentStatus;
  accessUntil: Date | null;
}

// Derives the plan a user is currently entitled to from their payment rows.
// Only CAPTURED payments with an unexpired accessUntil ever grant a plan;
// everything else (CREATED/FAILED/REFUNDED, or an expired accessUntil) is
// ignored. When more than one plan is simultaneously unexpired, the higher
// tier always wins (buying MAX while CORE is still active is immediately
// MAX; when MAX later expires, an unexpired CORE row takes over rather than
// dropping straight to FREE). accessUntil is treated as exclusive: a payment
// whose accessUntil equals `now` no longer entitles.
export function resolveEntitledPlan(
  payments: readonly EntitlingPayment[],
  now: Date,
): ResolvedEntitlement {
  let best: ResolvedEntitlement = { plan: 'FREE', planExpiresAt: null };
  for (const payment of payments) {
    if (payment.status !== 'CAPTURED') continue;
    if (payment.plan === 'FREE') continue;
    if (!payment.accessUntil || payment.accessUntil.getTime() <= now.getTime()) continue;

    const isHigherTier = PLAN_RANK[payment.plan] > PLAN_RANK[best.plan];
    const isSameTierLaterExpiry =
      payment.plan === best.plan &&
      (!best.planExpiresAt || payment.accessUntil.getTime() > best.planExpiresAt.getTime());

    if (isHigherTier || isSameTierLaterExpiry) {
      best = { plan: payment.plan, planExpiresAt: payment.accessUntil };
    }
  }
  return best;
}

// Computes the [accessFrom, accessUntil) window for a captured payment.
// `existingAccessUntil` must be the caller-resolved latest unexpired
// accessUntil for the SAME plan (or null for a fresh purchase / a purchase
// of a different plan than any currently-active access — cross-plan access
// never stacks). Early renewal extends from the existing expiry rather than
// from `paidAt`, so paying again with time still remaining never discards it.
export function computeAccessWindow(input: {
  paidAt: Date;
  existingAccessUntil: Date | null;
  accessDays?: number;
}): { accessFrom: Date; accessUntil: Date } {
  const accessDays = input.accessDays ?? PLAN_ACCESS_DAYS_DEFAULT;
  const durationMs = accessDays * 24 * 60 * 60 * 1000;
  const hasUnexpiredAccess =
    input.existingAccessUntil !== null &&
    input.existingAccessUntil.getTime() > input.paidAt.getTime();
  const accessFrom = hasUnexpiredAccess ? input.existingAccessUntil! : input.paidAt;
  const accessUntil = new Date(accessFrom.getTime() + durationMs);
  return { accessFrom, accessUntil };
}
