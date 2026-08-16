import type { Prisma, UsageActionType, UsageEventStatus } from '@prisma/client';
import { prisma } from '../prisma';
import {
  METERED_USAGE_ACTIONS,
  PLAN_LIMITS,
  USAGE_RESERVATION_TIMEOUT_MS,
  USAGE_WINDOW_MS,
  estimateProviderCostUsd,
  type MeteredUsageAction,
  type PlanName,
} from './config';
import type { UsageActionSummary, UsageLimitDetails, UsageSummary } from './types';

interface WindowEvent {
  status: UsageEventStatus | 'PENDING' | 'COMMITTED';
  createdAt: Date;
}

export function calculateUsageWindow(input: {
  events: readonly WindowEvent[];
  limit: number;
  now: Date;
  windowMs?: number;
  reservationTimeoutMs?: number;
}): UsageActionSummary & { reserved: number } {
  const windowMs = input.windowMs ?? USAGE_WINDOW_MS;
  const reservationTimeoutMs =
    input.reservationTimeoutMs ?? USAGE_RESERVATION_TIMEOUT_MS;
  const windowStart = input.now.getTime() - windowMs;
  const pendingStart = input.now.getTime() - reservationTimeoutMs;
  const committed = input.events
    .filter(
      (event) =>
        event.status === 'COMMITTED' && event.createdAt.getTime() > windowStart,
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const pending = input.events.filter(
    (event) =>
      event.status === 'PENDING' && event.createdAt.getTime() >= pendingStart,
  );
  const used = committed.length;
  return {
    used,
    limit: input.limit,
    remaining: Math.max(0, input.limit - used),
    reserved: used + pending.length,
    nextAvailableAt:
      committed.length > 0
        ? new Date(committed[0].createdAt.getTime() + windowMs).toISOString()
        : null,
  };
}

function normalizeTokenCount(value: number | null | undefined): number | null {
  return Number.isInteger(value) && value! >= 0 ? value! : null;
}

async function ensureUser(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string,
): Promise<{ plan: PlanName }> {
  const user = await db.user.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {},
    select: { plan: true },
  });
  return { plan: user.plan as PlanName };
}

export type UsageReservationResult =
  | { allowed: true; usageEventId: string }
  | { allowed: false; details: UsageLimitDetails };

export function shouldCommitChatUsage(input: {
  providerCompleted: boolean;
  assistantPersisted: boolean;
  intentionalCancellation: boolean;
}): boolean {
  if (!input.providerCompleted) return false;
  if (input.assistantPersisted) return true;
  return !input.intentionalCancellation;
}

export async function checkAndReserve(
  userId: string,
  actionType: MeteredUsageAction,
  options: { now?: Date; limitOverride?: number } = {},
): Promise<UsageReservationResult> {
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - USAGE_RESERVATION_TIMEOUT_MS);
  const windowStart = new Date(now.getTime() - USAGE_WINDOW_MS);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const { plan } = await ensureUser(tx, userId);
    await tx.usageEvent.deleteMany({
      where: { userId, status: 'PENDING', createdAt: { lt: staleBefore } },
    });
    const events = await tx.usageEvent.findMany({
      where: {
        userId,
        actionType: actionType as UsageActionType,
        OR: [
          { status: 'COMMITTED', createdAt: { gt: windowStart } },
          { status: 'PENDING', createdAt: { gte: staleBefore } },
        ],
      },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const limit = options.limitOverride ?? PLAN_LIMITS[plan][actionType];
    const current = calculateUsageWindow({ events, limit, now });
    if (current.reserved >= limit) {
      return {
        allowed: false as const,
        details: {
          actionType,
          plan,
          used: current.used,
          limit,
          remaining: current.remaining,
          nextAvailableAt: current.nextAvailableAt,
        },
      };
    }
    const event = await tx.usageEvent.create({
      data: { userId, actionType: actionType as UsageActionType, status: 'PENDING' },
      select: { id: true },
    });
    return { allowed: true as const, usageEventId: event.id };
  });
}

export async function commitUsage(
  usageEventId: string,
  metadata: {
    provider?: string | null;
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
  } = {},
): Promise<void> {
  const inputTokens = normalizeTokenCount(metadata.inputTokens);
  const outputTokens = normalizeTokenCount(metadata.outputTokens);
  await prisma.usageEvent.updateMany({
    where: { id: usageEventId, status: 'PENDING' },
    data: {
      status: 'COMMITTED',
      committedAt: new Date(),
      provider: metadata.provider?.trim() || null,
      model: metadata.model?.trim() || null,
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateProviderCostUsd({
        model: metadata.model,
        inputTokens,
        outputTokens,
      }),
    },
  });
}

export async function discardUsage(usageEventId: string): Promise<void> {
  await prisma.usageEvent.deleteMany({
    where: { id: usageEventId, status: 'PENDING' },
  });
}

export async function getUsageSummary(
  userId: string,
  options: { now?: Date } = {},
): Promise<UsageSummary> {
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - USAGE_RESERVATION_TIMEOUT_MS);
  const windowStart = new Date(now.getTime() - USAGE_WINDOW_MS);
  const { plan } = await ensureUser(prisma, userId);
  await prisma.usageEvent.deleteMany({
    where: { userId, status: 'PENDING', createdAt: { lt: staleBefore } },
  });
  const events = await prisma.usageEvent.findMany({
    where: {
      userId,
      actionType: { in: [...METERED_USAGE_ACTIONS] as UsageActionType[] },
      OR: [
        { status: 'COMMITTED', createdAt: { gt: windowStart } },
        { status: 'PENDING', createdAt: { gte: staleBefore } },
      ],
    },
    select: { actionType: true, status: true, createdAt: true },
  });
  const perAction = Object.fromEntries(
    METERED_USAGE_ACTIONS.map((actionType) => [
      actionType,
      calculateUsageWindow({
        events: events.filter((event) => event.actionType === actionType),
        limit: PLAN_LIMITS[plan][actionType],
        now,
      }),
    ]),
  ) as unknown as UsageSummary['perAction'];
  for (const action of METERED_USAGE_ACTIONS) {
    delete (perAction[action] as UsageActionSummary & { reserved?: number }).reserved;
  }
  return {
    plan,
    windowHours: 12,
    perAction,
    planLimits: PLAN_LIMITS,
  };
}

export async function setUserPlanForDemo(
  userId: string,
  plan: PlanName,
): Promise<void> {
  if (process.env.ALLOW_DEMO_PLAN_UPDATE !== 'true') {
    throw new Error('Demo plan updates require ALLOW_DEMO_PLAN_UPDATE=true');
  }
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, plan },
    update: { plan },
  });
}
