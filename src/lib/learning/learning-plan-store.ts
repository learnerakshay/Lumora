import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { LearningPath, ReadinessReport } from './types';

export type LearningPlanStatus = 'BUILDING' | 'READY' | 'FAILED';

export interface LearningWorkspaceLinkRecord {
  id: string;
  planId: string;
  workspaceId: string;
  createdAt: string;
}

export interface LearningPlanRecord {
  id: string;
  userId: string;
  analysisId: string;
  version: number;
  status: LearningPlanStatus;
  roleId: string;
  engineVersion: string;
  narrativeModel: string | null;
  selectedGapIds: string[];
  path: LearningPath | null;
  readiness: ReadinessReport | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceLinks: LearningWorkspaceLinkRecord[];
}

function toLinkRecord(row: {
  id: string;
  planId: string;
  workspaceId: string;
  createdAt: Date;
}): LearningWorkspaceLinkRecord {
  return {
    id: row.id,
    planId: row.planId,
    workspaceId: row.workspaceId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toLearningPlanRecord(row: {
  id: string;
  userId: string;
  analysisId: string;
  version: number;
  status: string;
  roleId: string;
  engineVersion: string;
  narrativeModel: string | null;
  selectedGapIds: unknown;
  path: unknown;
  readiness: unknown;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  workspaceLinks: Array<{ id: string; planId: string; workspaceId: string; createdAt: Date }>;
}): LearningPlanRecord {
  return {
    id: row.id,
    userId: row.userId,
    analysisId: row.analysisId,
    version: row.version,
    status: row.status as LearningPlanStatus,
    roleId: row.roleId,
    engineVersion: row.engineVersion,
    narrativeModel: row.narrativeModel,
    selectedGapIds: (row.selectedGapIds as string[] | null) ?? [],
    path: (row.path as LearningPath | null) ?? null,
    readiness: (row.readiness as ReadinessReport | null) ?? null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    workspaceLinks: row.workspaceLinks.map(toLinkRecord),
  };
}

export async function createBuildingLearningPlan(input: {
  userId: string;
  analysisId: string;
  roleId: string;
  engineVersion: string;
  selectedGapIds: string[];
}): Promise<LearningPlanRecord> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const latest = await prisma.learningPlan.findFirst({
      where: { userId: input.userId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    try {
      const created = await prisma.learningPlan.create({
        data: {
          userId: input.userId,
          analysisId: input.analysisId,
          roleId: input.roleId,
          version: nextVersion,
          status: 'BUILDING',
          engineVersion: input.engineVersion,
          selectedGapIds: input.selectedGapIds as unknown as Prisma.InputJsonValue,
        },
        include: { workspaceLinks: true },
      });
      return toLearningPlanRecord(created);
    } catch (error) {
      const isVersionConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isVersionConflict || attempt === 2) throw error;
    }
  }
  throw new Error('Could not allocate a Learning Plan version after retrying');
}

export async function markLearningPlanReady(
  planId: string,
  data: { path: LearningPath; readiness: ReadinessReport; narrativeModel: string | null },
): Promise<LearningPlanRecord> {
  const updated = await prisma.learningPlan.update({
    where: { id: planId },
    data: {
      status: 'READY',
      path: data.path as unknown as Prisma.InputJsonValue,
      readiness: data.readiness as unknown as Prisma.InputJsonValue,
      narrativeModel: data.narrativeModel,
      errorMessage: null,
    },
    include: { workspaceLinks: true },
  });
  return toLearningPlanRecord(updated);
}

export async function markLearningPlanFailed(planId: string, errorMessage: string): Promise<void> {
  await prisma.learningPlan.update({
    where: { id: planId },
    data: { status: 'FAILED', errorMessage },
  });
}

export async function getLatestLearningPlan(userId: string): Promise<LearningPlanRecord | null> {
  const plan = await prisma.learningPlan.findFirst({
    where: { userId },
    orderBy: { version: 'desc' },
    include: { workspaceLinks: true },
  });
  return plan ? toLearningPlanRecord(plan) : null;
}

export async function getLearningPlanForUser(
  planId: string,
  userId: string,
): Promise<LearningPlanRecord | null> {
  const plan = await prisma.learningPlan.findFirst({
    where: { id: planId, userId },
    include: { workspaceLinks: true },
  });
  return plan ? toLearningPlanRecord(plan) : null;
}

// Defensive uniqueness only (planId, workspaceId): the "one Workspace per
// plan" business rule is enforced by the route checking existing
// workspaceLinks before ever calling this, not by this constraint alone.
export async function createLearningWorkspaceLink(input: {
  planId: string;
  workspaceId: string;
}): Promise<LearningWorkspaceLinkRecord> {
  const link = await prisma.learningWorkspaceLink.upsert({
    where: { planId_workspaceId: { planId: input.planId, workspaceId: input.workspaceId } },
    create: { planId: input.planId, workspaceId: input.workspaceId },
    update: {},
  });
  return toLinkRecord(link);
}

export async function deleteLearningPlanForUser(planId: string, userId: string): Promise<number> {
  const result = await prisma.learningPlan.deleteMany({ where: { id: planId, userId } });
  return result.count;
}
