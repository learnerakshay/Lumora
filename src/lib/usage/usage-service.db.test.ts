import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma';
import {
  checkAndReserve,
  commitUsage,
  discardUsage,
  getUsageSummary,
} from './service';

const runDatabaseTests = process.env.RUN_DATABASE_USAGE_TESTS === 'true';

test('fresh identities are provisioned as FREE on summary and reservation first touch', { skip: !runDatabaseTests }, async () => {
  const summaryUserId = `usage-new-summary-${randomUUID()}`;
  const meteredUserId = `usage-new-metered-${randomUUID()}`;
  try {
    assert.equal(await prisma.user.findUnique({ where: { id: summaryUserId } }), null);
    const initialSummary = await getUsageSummary(summaryUserId);
    assert.equal(initialSummary.plan, 'FREE');
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: summaryUserId } })).plan,
      'FREE',
    );

    assert.equal(await prisma.user.findUnique({ where: { id: meteredUserId } }), null);
    const reservation = await checkAndReserve(meteredUserId, 'CHAT');
    assert.ok('usageEventId' in reservation);
    if ('usageEventId' in reservation) await commitUsage(reservation.usageEventId);
    const meteredUser = await prisma.user.findUniqueOrThrow({ where: { id: meteredUserId } });
    assert.equal(meteredUser.plan, 'FREE');
    assert.equal((await getUsageSummary(meteredUserId)).perAction.CHAT.used, 1);
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: [summaryUserId, meteredUserId] } },
    });
  }
});

test('real advisory lock permits exactly one simultaneous final-capacity reservation', { skip: !runDatabaseTests }, async () => {
  const userId = `usage-concurrency-${randomUUID()}`;
  try {
    await prisma.user.create({ data: { id: userId, plan: 'FREE' } });
    const [first, second] = await Promise.all([
      checkAndReserve(userId, 'CHAT', { limitOverride: 1 }),
      checkAndReserve(userId, 'CHAT', { limitOverride: 1 }),
    ]);
    const allowed = [first, second].filter((result) => result.allowed);
    const rejected = [first, second].filter((result) => !result.allowed);
    assert.equal(allowed.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal('details' in rejected[0] ? rejected[0].details.limit : null, 1);
    if ('usageEventId' in allowed[0]) await discardUsage(allowed[0].usageEventId);
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

test('real service commits success, discards failure, and isolates users', { skip: !runDatabaseTests }, async () => {
  const userId = `usage-accounting-${randomUUID()}`;
  const otherUserId = `usage-other-${randomUUID()}`;
  try {
    await prisma.user.createMany({
      data: [
        { id: userId, plan: 'CORE' },
        { id: otherUserId, plan: 'MAX' },
      ],
    });
    const chat = await checkAndReserve(userId, 'CHAT');
    assert.ok('usageEventId' in chat);
    if ('usageEventId' in chat) {
      await commitUsage(chat.usageEventId, {
        provider: 'openai',
        model: 'gpt-5.6-sol',
        inputTokens: 100,
        outputTokens: 20,
      });
    }
    const ingestion = await checkAndReserve(userId, 'INGESTION');
    assert.ok('usageEventId' in ingestion);
    if ('usageEventId' in ingestion) await discardUsage(ingestion.usageEventId);

    await prisma.usageEvent.create({
      data: { userId: otherUserId, actionType: 'CHAT', status: 'COMMITTED', committedAt: new Date() },
    });
    const summary = await getUsageSummary(userId);
    assert.equal(summary.plan, 'CORE');
    assert.equal(summary.perAction.CHAT.used, 1);
    assert.equal(summary.perAction.INGESTION.used, 0);
    assert.equal(summary.perAction.AI_ACTION.used, 0);
    const committedEvent = await prisma.usageEvent.findFirstOrThrow({
      where: { userId, actionType: 'CHAT' },
    });
    assert.equal(committedEvent.status, 'COMMITTED');
    assert.equal(committedEvent.inputTokens, 100);
    assert.equal(committedEvent.outputTokens, 20);
    assert.ok((committedEvent.estimatedCostUsd || 0) > 0);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  }
});

test.after(async () => {
  if (runDatabaseTests) await prisma.$disconnect();
});
