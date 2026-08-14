import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_LIMITS, USAGE_WINDOW_MS, estimateProviderCostUsd } from './config';
import { calculateUsageWindow, shouldCommitChatUsage } from './service';

const now = new Date('2026-08-14T12:00:00.000Z');
const committed = (createdAt: string) => ({ status: 'COMMITTED' as const, createdAt: new Date(createdAt) });
const pending = (createdAt: string) => ({ status: 'PENDING' as const, createdAt: new Date(createdAt) });

test('empty rolling window has full remaining capacity', () => {
  assert.deepEqual(calculateUsageWindow({ events: [], limit: 8, now }), {
    used: 0,
    limit: 8,
    remaining: 8,
    reserved: 0,
    nextAvailableAt: null,
  });
});

test('committed events consume visible usage and recover from the oldest event', () => {
  const result = calculateUsageWindow({
    events: [
      committed('2026-08-14T11:00:00.000Z'),
      committed('2026-08-14T10:00:00.000Z'),
    ],
    limit: 8,
    now,
  });
  assert.equal(result.used, 2);
  assert.equal(result.remaining, 6);
  assert.equal(result.nextAvailableAt, '2026-08-15T10:00:00.000Z');
});

test('the exact 24-hour boundary is included while an older event is excluded', () => {
  const result = calculateUsageWindow({
    events: [
      committed('2026-08-13T12:00:00.000Z'),
      committed('2026-08-13T11:59:59.999Z'),
      committed('2026-08-13T12:00:00.001Z'),
    ],
    limit: 8,
    now,
  });
  assert.equal(result.used, 2);
  assert.equal(result.nextAvailableAt, '2026-08-14T12:00:00.000Z');
});

test('aging an event outside the rolling window restores remaining capacity', () => {
  const event = committed('2026-08-13T12:00:00.000Z');
  assert.equal(calculateUsageWindow({ events: [event], limit: 1, now }).remaining, 0);
  assert.equal(
    calculateUsageWindow({
      events: [event],
      limit: 1,
      now: new Date(now.getTime() + 1),
    }).remaining,
    1,
  );
});

test('active pending reservations enforce capacity without appearing as consumed usage', () => {
  const result = calculateUsageWindow({
    events: [committed('2026-08-14T11:00:00.000Z'), pending('2026-08-14T11:59:00.000Z')],
    limit: 2,
    now,
  });
  assert.equal(result.used, 1);
  assert.equal(result.remaining, 1);
  assert.equal(result.reserved, 2);
});

test('stale pending reservations do not hold capacity', () => {
  const result = calculateUsageWindow({
    events: [pending('2026-08-14T11:54:59.999Z')],
    limit: 1,
    now,
  });
  assert.equal(result.reserved, 0);
});

test('plan configuration keeps distinct limits per plan and action type', () => {
  assert.deepEqual(PLAN_LIMITS.FREE, { CHAT: 8, INGESTION: 3, AI_ACTION: 5 });
  assert.equal(PLAN_LIMITS.CORE.CHAT, 40);
  assert.equal(PLAN_LIMITS.CORE.INGESTION, 15);
  assert.equal(PLAN_LIMITS.MAX.AI_ACTION, 80);
  assert.equal(USAGE_WINDOW_MS, 86_400_000);
});

test('provider cost uses exact reported tokens and centralized pricing', () => {
  assert.equal(
    estimateProviderCostUsd({ model: 'gpt-5.6-sol', inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    35,
  );
  assert.equal(
    estimateProviderCostUsd({ model: 'text-embedding-3-small', inputTokens: 1_000_000 }),
    0.02,
  );
  assert.equal(estimateProviderCostUsd({ model: 'unknown', inputTokens: 10 }), null);
});

test('Stop before provider completion discards the reservation', () => {
  assert.equal(
    shouldCommitChatUsage({
      providerCompleted: false,
      assistantPersisted: false,
      intentionalCancellation: true,
    }),
    false,
  );
});

test('Stop after durable assistant success commits completed provider work', () => {
  assert.equal(
    shouldCommitChatUsage({
      providerCompleted: true,
      assistantPersisted: true,
      intentionalCancellation: true,
    }),
    true,
  );
  assert.equal(
    shouldCommitChatUsage({
      providerCompleted: true,
      assistantPersisted: false,
      intentionalCancellation: true,
    }),
    false,
  );
});
