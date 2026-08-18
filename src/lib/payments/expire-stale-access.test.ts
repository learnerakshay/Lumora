import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { createExpireStalePaidAccessMiddleware, type ExpireStaleAccessDeps } from './expire-stale-access';

const FAKE_REQ = {} as Request;
const FAKE_RES = {} as Response;

function waitForNext(): { next: () => void; promise: Promise<void> } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { next: resolve, promise };
}

function baseDeps(overrides: Partial<ExpireStaleAccessDeps>): ExpireStaleAccessDeps {
  return {
    getUserId: () => null,
    findUserPlanExpiry: async () => null,
    syncUserEntitlement: async () => ({ changed: false, plan: 'FREE', planExpiresAt: null }),
    ...overrides,
  };
}

test('an unauthenticated request is a no-op: next() is called and no DB read happens', async () => {
  let dbReads = 0;
  const deps = baseDeps({
    getUserId: () => null,
    findUserPlanExpiry: async () => {
      dbReads += 1;
      return null;
    },
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);
  const { next, promise } = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, next);
  await promise;
  assert.equal(dbReads, 0);
});

// Real Clerk internals throw if clerkMiddleware wasn't registered first
// (verified directly against @clerk/express in development). getUserId must
// never be allowed to crash the request pipeline synchronously.
test('getUserId throwing is swallowed and next() still runs', async () => {
  const deps = baseDeps({
    getUserId: () => {
      throw new Error('clerkMiddleware not registered');
    },
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);
  const { next, promise } = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, next);
  await assert.doesNotReject(promise);
});

test('a user with no planExpiresAt (FREE, or never purchased) is left alone', async () => {
  const syncCalls: unknown[] = [];
  const deps = baseDeps({
    getUserId: () => 'user_1',
    findUserPlanExpiry: async () => ({ plan: 'FREE', planExpiresAt: null }),
    syncUserEntitlement: async (...args) => {
      syncCalls.push(args);
      return { changed: false, plan: 'FREE', planExpiresAt: null };
    },
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);
  const { next, promise } = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, next);
  await promise;
  assert.equal(syncCalls.length, 0);
});

test('a user whose planExpiresAt is still in the future is left alone', async () => {
  const syncCalls: unknown[] = [];
  const now = 1_000_000;
  const deps = baseDeps({
    getUserId: () => 'user_2',
    findUserPlanExpiry: async () => ({ plan: 'CORE', planExpiresAt: new Date(now + 60_000) }),
    syncUserEntitlement: async (...args) => {
      syncCalls.push(args);
      return { changed: false, plan: 'CORE', planExpiresAt: new Date(now + 60_000) };
    },
    now: () => now,
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);
  const { next, promise } = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, next);
  await promise;
  assert.equal(syncCalls.length, 0);
});

test('a user whose planExpiresAt has passed triggers syncUserEntitlement with reason ACCESS_EXPIRED', async () => {
  const syncCalls: unknown[] = [];
  const now = 1_000_000;
  const deps = baseDeps({
    getUserId: () => 'user_3',
    findUserPlanExpiry: async () => ({ plan: 'CORE', planExpiresAt: new Date(now - 60_000) }),
    syncUserEntitlement: async (...args) => {
      syncCalls.push(args);
      return { changed: true, plan: 'FREE', planExpiresAt: null };
    },
    now: () => now,
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);
  const { next, promise } = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, next);
  await promise;
  assert.equal(syncCalls.length, 1);
  assert.deepEqual(syncCalls[0], ['user_3', 'ACCESS_EXPIRED', new Date(now)]);
});

// Boundary: accessUntil === now must not entitle (matches access.ts's
// exclusive-boundary rule), so an exactly-expired timestamp must still
// trigger the resync.
test('planExpiresAt exactly equal to now also triggers expiry (exclusive boundary)', async () => {
  const syncCalls: unknown[] = [];
  const now = 1_000_000;
  const deps = baseDeps({
    getUserId: () => 'user_boundary',
    findUserPlanExpiry: async () => ({ plan: 'CORE', planExpiresAt: new Date(now) }),
    syncUserEntitlement: async (...args) => {
      syncCalls.push(args);
      return { changed: true, plan: 'FREE', planExpiresAt: null };
    },
    now: () => now,
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);
  const { next, promise } = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, next);
  await promise;
  assert.equal(syncCalls.length, 1);
});

test('within the cache TTL, a second request for the same user does not re-check the database', async () => {
  let dbReads = 0;
  const now = 1_000_000;
  const deps = baseDeps({
    getUserId: () => 'user_4',
    findUserPlanExpiry: async () => {
      dbReads += 1;
      return { plan: 'CORE', planExpiresAt: new Date(now + 60_000) };
    },
    now: () => now,
    cacheTtlMs: 60_000,
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);

  const first = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, first.next);
  await first.promise;

  const second = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, second.next);
  await second.promise;

  assert.equal(dbReads, 1);
});

test('after the cache TTL elapses, the next request re-checks the database', async () => {
  let dbReads = 0;
  let currentTime = 1_000_000;
  const deps = baseDeps({
    getUserId: () => 'user_5',
    findUserPlanExpiry: async () => {
      dbReads += 1;
      return { plan: 'CORE', planExpiresAt: new Date(currentTime + 60_000) };
    },
    now: () => currentTime,
    cacheTtlMs: 60_000,
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);

  const first = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, first.next);
  await first.promise;

  currentTime += 61_000; // past the TTL
  const second = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, second.next);
  await second.promise;

  assert.equal(dbReads, 2);
});

test('different users are cached independently', async () => {
  let dbReads = 0;
  const now = 1_000_000;
  let currentUser = 'user_a';
  const deps = baseDeps({
    getUserId: () => currentUser,
    findUserPlanExpiry: async () => {
      dbReads += 1;
      return { plan: 'CORE', planExpiresAt: new Date(now + 60_000) };
    },
    now: () => now,
    cacheTtlMs: 60_000,
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);

  const first = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, first.next);
  await first.promise;

  currentUser = 'user_b';
  const second = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, second.next);
  await second.promise;

  assert.equal(dbReads, 2);
});

test('a database error is swallowed and next() is still called — a payments hiccup never breaks the request', async () => {
  const deps = baseDeps({
    getUserId: () => 'user_6',
    findUserPlanExpiry: async () => {
      throw new Error('connection reset');
    },
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);
  const { next, promise } = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, next);
  await assert.doesNotReject(promise);
});

test('a syncUserEntitlement error during expiry is also swallowed and next() still runs', async () => {
  const now = 1_000_000;
  const deps = baseDeps({
    getUserId: () => 'user_7',
    findUserPlanExpiry: async () => ({ plan: 'CORE', planExpiresAt: new Date(now - 1) }),
    syncUserEntitlement: async () => {
      throw new Error('advisory lock timeout');
    },
    now: () => now,
  });
  const middleware = createExpireStalePaidAccessMiddleware(deps);
  const { next, promise } = waitForNext();
  middleware(FAKE_REQ, FAKE_RES, next);
  await assert.doesNotReject(promise);
});
