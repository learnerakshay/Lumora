// Pure presentation helpers over the entitlement data AccessProvider and
// usePaymentHistory expose. This module does NOT reimplement entitlement
// logic — resolveEntitledPlan / computeAccessWindow (src/lib/payments/
// access.ts) remain the only source of truth for what plan a user has and
// when it expires. Everything here only formats/describes that already-
// resolved state.
import type { PlanName } from '../usage/config';
import type { PaidPlan } from './config';
import type { PaymentHistoryRecord } from '../../components/payments/usePaymentHistory';

export type ExpiryBand = 'none' | 'approaching' | 'urgent' | 'expired';

const APPROACHING_THRESHOLD_DAYS = 7;
const URGENT_THRESHOLD_DAYS = 2;

// accessUntil is treated as EXCLUSIVE, matching resolveEntitledPlan /
// computeAccessWindow in access.ts: a payment whose accessUntil equals
// `now` no longer entitles. daysRemaining therefore returns 0 (not
// negative, not 1) exactly at the boundary, and callers should treat 0 as
// "expired", not "last day".
export function daysRemaining(planExpiresAt: string | Date | null, now: Date = new Date()): number {
  if (!planExpiresAt) return 0;
  const expiresAt = typeof planExpiresAt === 'string' ? new Date(planExpiresAt) : planExpiresAt;
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

// Bands drive the ExpiryBanner (Phase 3C): 'none' for FREE or a plan with
// no expiry to worry about yet, 'approaching' inside 7 days, 'urgent'
// inside 2 days, 'expired' once accessUntil has passed (or was never paid
// access to begin with but the caller still wants an expired-style
// message — see hadPaidAccess below for distinguishing that case).
export function expiryBand(
  plan: PlanName | null,
  planExpiresAt: string | Date | null,
  now: Date = new Date(),
): ExpiryBand {
  if (!plan || plan === 'FREE') return 'none';
  if (!planExpiresAt) return 'none';
  const remainingDays = daysRemaining(planExpiresAt, now);
  const expiresAt = typeof planExpiresAt === 'string' ? new Date(planExpiresAt) : planExpiresAt;
  if (expiresAt.getTime() <= now.getTime()) return 'expired';
  if (remainingDays <= URGENT_THRESHOLD_DAYS) return 'urgent';
  if (remainingDays <= APPROACHING_THRESHOLD_DAYS) return 'approaching';
  return 'none';
}

// Distinguishes "never purchased anything" from "purchased, now expired" —
// both currently resolve to plan === 'FREE', but they need different
// copy on /billing (Phase 3C): a fresh FREE user sees a pricing CTA, a
// lapsed paid user sees an explicit expired state.
export function hadPaidAccess(history: readonly PaymentHistoryRecord[]): boolean {
  return history.some((record) => record.status === 'CAPTURED');
}

// Latest CAPTURED payment's accessFrom — the "your access started on"
// date for /billing. Returns null if the user has never had a captured
// payment. Ties are broken by createdAt (most recent capture wins), never
// by array order, since history ordering is a server concern this module
// must not assume.
export function purchaseDateFrom(history: readonly PaymentHistoryRecord[]): string | null {
  const captured = history.filter((record) => record.status === 'CAPTURED' && record.accessFrom);
  if (captured.length === 0) return null;
  const latest = captured.reduce((best, record) =>
    new Date(record.createdAt).getTime() > new Date(best.createdAt).getTime() ? record : best,
  );
  return latest.accessFrom;
}

// Most recent CAPTURED payment's plan+accessUntil pair, used to explain
// what a renewal or upgrade will actually do without recomputing the
// stacking math client-side.
export function latestCapturedAccess(
  history: readonly PaymentHistoryRecord[],
): { plan: PaidPlan; accessUntil: string | null } | null {
  const captured = history.filter((record) => record.status === 'CAPTURED');
  if (captured.length === 0) return null;
  const latest = captured.reduce((best, record) =>
    new Date(record.createdAt).getTime() > new Date(best.createdAt).getTime() ? record : best,
  );
  return { plan: latest.plan, accessUntil: latest.accessUntil };
}

// Which /billing view to render. Both FREE variants resolve from the same
// `plan === 'FREE'` entitlement state, but need different copy: a user who
// never paid gets a pricing nudge, a user whose access lapsed gets an
// explicit "your access ended" state.
export type BillingStatus = 'free_no_history' | 'free_expired' | 'active';

export function billingStatus(
  plan: PlanName | null,
  history: readonly PaymentHistoryRecord[],
): BillingStatus {
  if (plan && plan !== 'FREE') return 'active';
  return hadPaidAccess(history) ? 'free_expired' : 'free_no_history';
}

export type StackingKind = 'renewal' | 'upgrade';

export interface StackingCopy {
  kind: StackingKind;
  headline: string;
  detail: string;
}

// Honest, non-inventive copy describing what buying `targetPlan` will do
// given the user's `currentPlan`. Mirrors computeAccessWindow (same-plan:
// extend from the existing expiry) and resolveEntitledPlan (cross-plan:
// higher tier wins now, lower tier resumes when the higher one lapses) —
// it does not implement either, only describes their real behavior so the
// UI can never promise proration or stacking that the backend doesn't do.
export function stackingCopyFor(currentPlan: PlanName, targetPlan: PaidPlan): StackingCopy {
  if (currentPlan === targetPlan) {
    return {
      kind: 'renewal',
      headline: 'Renew your plan',
      detail:
        'Your 30 days are added to your remaining time — nothing is lost by renewing early.',
    };
  }
  if (currentPlan === 'CORE' && targetPlan === 'MAX') {
    return {
      kind: 'upgrade',
      headline: 'Upgrade to MAX',
      detail:
        'MAX access starts today for 30 days. Your remaining CORE days are preserved and resume if MAX access ends first.',
    };
  }
  // FREE -> CORE/MAX, or MAX -> CORE (not a real upgrade path but handled
  // honestly rather than assumed away): a fresh purchase, no existing
  // access to preserve.
  return {
    kind: 'upgrade',
    headline: `Get ${targetPlan}`,
    detail: `${targetPlan} access starts today for 30 days.`,
  };
}
