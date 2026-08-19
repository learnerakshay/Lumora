import { logger } from '../logger';
import { computeAccessWindow } from './access';
import { findCouponById, incrementCouponRedemption } from './coupon-store';
import { syncUserEntitlement, type EntitlementSyncReason, type EntitlementSyncResult } from './entitlement-sync';
import { FACULTY_COUPON_CODE, markFacultyEntitlement } from './faculty-store';
import { getLatestUnexpiredAccessUntil, getPaymentByOrderId, markPaymentCaptured } from './payment-store';

export interface CaptureResult {
  // true if this call (or a caller that raced it and won) resulted in the
  // payment being CAPTURED. false only when the order is unknown.
  captured: boolean;
  reason?: 'ALREADY_CAPTURED' | 'ORDER_NOT_FOUND';
  entitlement?: EntitlementSyncResult;
}

// The single routine that turns a provider-confirmed payment into 30 days of
// access. Used identically by POST /order/verify and the webhook handler
// (payment.captured / order.paid) so there is exactly one place that decides
// the access window (with renewal stacking), captures the payment, credits
// the coupon, and re-syncs entitlement. The two callers only differ in how
// they learned the payment succeeded (a signed client callback vs. a signed
// webhook) — by the time either reaches here, the caller has already done
// its own authoritative verification.
//
// Idempotency: markPaymentCaptured only transitions CREATED -> CAPTURED via
// an UPDATE ... WHERE status = 'CREATED'. If /verify and the webhook race
// each other, whichever commits first wins that compare-and-swap; the loser
// gets `count: 0` back (see payment-store.ts). Critically, the loser must
// NOT report `captured: false` from its own stale pre-race read — by the
// time it loses the CAS, the winner has already committed CAPTURED, so the
// loser re-fetches the row to report the true current state. A caller (e.g.
// a paying user's own /order/verify request) must never be told their
// payment failed just because a webhook happened to win a race it didn't
// know it was in.
export async function capturePayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
  method: string | null;
  signatureVerified: boolean;
  reason: EntitlementSyncReason;
  now?: Date;
}): Promise<CaptureResult> {
  const now = input.now ?? new Date();
  const existing = await getPaymentByOrderId(input.providerOrderId);
  if (!existing) {
    logger.warn('Capture attempted for an unknown order', { providerOrderId: input.providerOrderId });
    return { captured: false, reason: 'ORDER_NOT_FOUND' };
  }

  let isCaptured = existing.status === 'CAPTURED';
  let justCaptured = false;

  if (!isCaptured) {
    const existingAccessUntil = await getLatestUnexpiredAccessUntil(existing.userId, existing.plan, now);
    const { accessFrom, accessUntil } = computeAccessWindow({ paidAt: now, existingAccessUntil });

    const captured = await markPaymentCaptured(input.providerOrderId, {
      providerPaymentId: input.providerPaymentId,
      method: input.method,
      accessFrom,
      accessUntil,
      signatureVerified: input.signatureVerified,
    });

    if (captured) {
      justCaptured = true;
      isCaptured = true;
      if (captured.couponId) {
        await incrementCouponRedemption(captured.couponId).catch((error) => {
          logger.error('Failed to increment coupon redemption after capture', error, {
            userId: existing.userId,
            couponId: captured.couponId,
          });
        });

        // Faculty/instructor status is granted off the coupon actually
        // redeemed on capture, not the plan — CHAICODE99 applies to both
        // CORE and MAX, and either should grant it. Checked here (inside
        // the CAS-winning branch only, like the redemption increment above)
        // so a webhook/verify race or retry can never grant it twice or
        // race a duplicate write; a lookup failure never blocks the
        // payment capture that already succeeded.
        try {
          const coupon = await findCouponById(captured.couponId);
          if (coupon?.code === FACULTY_COUPON_CODE) {
            await markFacultyEntitlement(existing.userId);
          }
        } catch (error) {
          logger.error('Failed to grant faculty entitlement after capture', error, {
            userId: existing.userId,
            couponId: captured.couponId,
          });
        }
      }
      logger.info('Payment captured and access granted', {
        userId: existing.userId,
        plan: existing.plan,
        providerOrderId: input.providerOrderId,
        accessFrom: accessFrom.toISOString(),
        accessUntil: accessUntil.toISOString(),
      });
    } else {
      // Lost the compare-and-swap. Re-check the CURRENT row rather than
      // trusting `existing`, which is now stale — the winner (whichever
      // caller that was) has already committed CAPTURED.
      const refetched = await getPaymentByOrderId(input.providerOrderId);
      isCaptured = refetched?.status === 'CAPTURED';
    }
  }

  // Always resync, whether this call captured the payment, lost a capture
  // race to a concurrent caller, or found the payment already captured from
  // an earlier call — the caller always gets the true current entitlement.
  const entitlement = await syncUserEntitlement(existing.userId, input.reason, now);

  return {
    captured: isCaptured,
    reason: justCaptured || !isCaptured ? undefined : 'ALREADY_CAPTURED',
    entitlement,
  };
}
