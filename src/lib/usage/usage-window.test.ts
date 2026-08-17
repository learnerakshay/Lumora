import assert from 'node:assert/strict';
import test from 'node:test';
import { METERED_USAGE_ACTIONS, PLAN_LIMITS, USAGE_WINDOW_MS, estimateProviderCostUsd } from './config';
import { calculateUsageWindow, shouldCommitChatUsage } from './service';

const now = new Date('2026-08-14T12:00:00.000Z');
const committed = (createdAt: string) => ({ status: 'COMMITTED' as const, createdAt: new Date(createdAt) });
const pending = (createdAt: string) => ({ status: 'PENDING' as const, createdAt: new Date(createdAt) });

test('empty rolling window has full remaining capacity', () => {
  assert.deepEqual(calculateUsageWindow({ events: [], limit: 10, now }), {
    used: 0,
    limit: 10,
    remaining: 10,
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
    limit: 10,
    now,
  });
  assert.equal(result.used, 2);
  assert.equal(result.remaining, 8);
  assert.equal(result.nextAvailableAt, '2026-08-14T22:00:00.000Z');
});

test('the exact 12-hour boundary expires while a newer event remains', () => {
  const result = calculateUsageWindow({
    events: [
      committed('2026-08-14T00:00:00.000Z'),
      committed('2026-08-13T23:59:59.999Z'),
      committed('2026-08-14T00:00:00.001Z'),
    ],
    limit: 10,
    now,
  });
  assert.equal(result.used, 1);
  assert.equal(result.nextAvailableAt, '2026-08-14T12:00:00.001Z');
});

test('aging an event outside the rolling window restores remaining capacity', () => {
  const event = committed('2026-08-14T00:00:00.001Z');
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
  assert.deepEqual(PLAN_LIMITS.FREE, { CHAT: 10, INGESTION: 4, AI_ACTION: 8, SKILL_INTELLIGENCE: 2, LEARNING_PATH: 2 });
  assert.equal(PLAN_LIMITS.CORE.CHAT, 40);
  assert.equal(PLAN_LIMITS.CORE.INGESTION, 15);
  assert.equal(PLAN_LIMITS.MAX.AI_ACTION, 80);
  assert.equal(PLAN_LIMITS.CORE.SKILL_INTELLIGENCE, 6);
  assert.equal(PLAN_LIMITS.MAX.SKILL_INTELLIGENCE, 15);
  assert.equal(PLAN_LIMITS.CORE.LEARNING_PATH, 6);
  assert.equal(PLAN_LIMITS.MAX.LEARNING_PATH, 15);
  assert.equal(USAGE_WINDOW_MS, 43_200_000);
});

test('every metered usage action has a configured limit for every plan', () => {
  for (const plan of ['FREE', 'CORE', 'MAX'] as const) {
    for (const action of METERED_USAGE_ACTIONS) {
      assert.equal(
        typeof PLAN_LIMITS[plan][action],
        'number',
        `${plan}.${action} must have a configured numeric limit`,
      );
    }
  }
});

test('FREE capacities allow their configured action counts and block the next reservation', () => {
  const cases = [
    { action: 'CHAT', limit: PLAN_LIMITS.FREE.CHAT },
    { action: 'INGESTION', limit: PLAN_LIMITS.FREE.INGESTION },
    { action: 'AI_ACTION', limit: PLAN_LIMITS.FREE.AI_ACTION },
  ] as const;
  for (const { action, limit } of cases) {
    const events = Array.from({ length: limit }, (_, index) =>
      committed(new Date(now.getTime() - (index + 1) * 1_000).toISOString()),
    );
    const result = calculateUsageWindow({ events, limit, now });
    assert.equal(result.used, limit, `${action} should allow ${limit} committed events`);
    assert.equal(result.remaining, 0);
    assert.equal(result.reserved >= limit, true, `${action} next reservation is blocked`);
  }
});

test('each committed event recovers independently after 12 continuous hours', () => {
  const events = [
    committed('2026-08-14T10:00:00.000Z'),
    committed('2026-08-14T11:00:00.000Z'),
  ];
  const atTenPm = calculateUsageWindow({
    events,
    limit: 2,
    now: new Date('2026-08-14T22:00:00.000Z'),
  });
  assert.equal(atTenPm.used, 1);
  assert.equal(atTenPm.nextAvailableAt, '2026-08-14T23:00:00.000Z');

  const atElevenPm = calculateUsageWindow({
    events,
    limit: 2,
    now: new Date('2026-08-14T23:00:00.000Z'),
  });
  assert.equal(atElevenPm.used, 0);
  assert.equal(atElevenPm.nextAvailableAt, null);
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
