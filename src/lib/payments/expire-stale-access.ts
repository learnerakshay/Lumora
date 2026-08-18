import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { getAuthenticatedUserId } from '../auth';
import { syncUserEntitlement } from './entitlement-sync';

const DEFAULT_CACHE_TTL_MS = 60_000;

export interface ExpireStaleAccessDeps {
  getUserId: (req: Request) => string | null;
  findUserPlanExpiry: (userId: string) => Promise<{ plan: string; planExpiresAt: Date | null } | null>;
  syncUserEntitlement: typeof syncUserEntitlement;
  cacheTtlMs?: number;
  now?: () => number;
}

const defaultDeps: ExpireStaleAccessDeps = {
  getUserId: getAuthenticatedUserId,
  findUserPlanExpiry: (userId) =>
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true } }),
  syncUserEntitlement,
};

// Runs on every /api request for a signed-in user. If their cached
// planExpiresAt has passed, re-derives entitlement (dropping them to FREE,
// or to a lower still-unexpired plan) before the request handler ever sees
// res.locals.userId. This is what makes "after accessUntil expires, the
// user safely returns to FREE" actually true for a one-time purchase —
// nothing external ever notifies us of expiry, so something on the request
// path has to check.
//
// A per-userId in-process cache bounds this to one DB read per user per
// cacheTtlMs, not one per request. The cache is deliberately unbounded for
// the hackathon's traffic scale; it resets on every deploy/restart. Every
// failure path — including getUserId itself throwing, which real Clerk
// internals can do — is swallowed so a payments hiccup never breaks the
// rest of the app.
export function createExpireStalePaidAccessMiddleware(deps: ExpireStaleAccessDeps = defaultDeps): RequestHandler {
  const cacheTtlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const now = deps.now ?? (() => Date.now());
  const checkedAt = new Map<string, number>();

  return (req: Request, _res: Response, next: NextFunction) => {
    let userId: string | null;
    try {
      userId = deps.getUserId(req);
    } catch (error) {
      logger.error('Stale-access expiry check could not resolve the authenticated user; continuing request unaffected', error);
      next();
      return;
    }
    if (!userId) {
      next();
      return;
    }

    const currentTime = now();
    const lastChecked = checkedAt.get(userId);
    if (lastChecked !== undefined && currentTime - lastChecked < cacheTtlMs) {
      next();
      return;
    }
    checkedAt.set(userId, currentTime);

    deps
      .findUserPlanExpiry(userId)
      .then(async (user) => {
        if (!user || user.plan === 'FREE' || !user.planExpiresAt) return;
        if (user.planExpiresAt.getTime() > currentTime) return;
        await deps.syncUserEntitlement(userId, 'ACCESS_EXPIRED', new Date(currentTime));
      })
      .catch((error) => {
        logger.error('Stale-access expiry check failed; continuing request unaffected', error, { userId });
      })
      .finally(() => next());
  };
}

export const expireStalePaidAccess = createExpireStalePaidAccessMiddleware();
