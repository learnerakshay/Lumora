import type { PlanName } from '../usage/config';

export type PaymentStatus = 'CREATED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
export type CouponKind = 'PERCENT' | 'FIXED';

export interface AccessWindow {
  accessFrom: Date;
  accessUntil: Date;
}

export interface ResolvedEntitlement {
  plan: PlanName;
  planExpiresAt: Date | null;
}
