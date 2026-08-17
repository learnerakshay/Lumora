import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type {
  ExtractedProfile,
  GapReport,
  NormalizedSkill,
  TargetRole,
} from './types';

export type SkillProfileStatus = 'EXTRACTING' | 'READY' | 'FAILED';
export type SkillProfileSourceKind = 'PDF' | 'TEXT' | 'IMAGE';

export interface SkillProfileRecord {
  id: string;
  userId: string;
  version: number;
  status: SkillProfileStatus;
  sourceKind: SkillProfileSourceKind;
  extraction: ExtractedProfile | null;
  normalizedSkills: NormalizedSkill[] | null;
  extractionModel: string | null;
  contractVersion: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleAnalysisRecord {
  id: string;
  profileId: string;
  engineVersion: string;
  selectedRoles: TargetRole[];
  gaps: GapReport;
  createdAt: string;
}

function toSkillProfileRecord(row: {
  id: string;
  userId: string;
  version: number;
  status: string;
  sourceKind: string;
  extraction: unknown;
  normalizedSkills: unknown;
  extractionModel: string | null;
  contractVersion: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SkillProfileRecord {
  return {
    id: row.id,
    userId: row.userId,
    version: row.version,
    status: row.status as SkillProfileStatus,
    sourceKind: row.sourceKind as SkillProfileSourceKind,
    extraction: (row.extraction as ExtractedProfile | null) ?? null,
    normalizedSkills: (row.normalizedSkills as NormalizedSkill[] | null) ?? null,
    extractionModel: row.extractionModel,
    contractVersion: row.contractVersion,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRoleAnalysisRecord(row: {
  id: string;
  profileId: string;
  engineVersion: string;
  selectedRoles: unknown;
  gaps: unknown;
  createdAt: Date;
}): RoleAnalysisRecord {
  return {
    id: row.id,
    profileId: row.profileId,
    engineVersion: row.engineVersion,
    selectedRoles: row.selectedRoles as TargetRole[],
    gaps: row.gaps as GapReport,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createExtractingSkillProfile(input: {
  userId: string;
  sourceKind: SkillProfileSourceKind;
  contractVersion: string;
}): Promise<SkillProfileRecord> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const latest = await prisma.skillProfile.findFirst({
      where: { userId: input.userId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    try {
      const created = await prisma.skillProfile.create({
        data: {
          userId: input.userId,
          version: nextVersion,
          status: 'EXTRACTING',
          sourceKind: input.sourceKind,
          contractVersion: input.contractVersion,
        },
      });
      return toSkillProfileRecord(created);
    } catch (error) {
      const isVersionConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isVersionConflict || attempt === 2) throw error;
    }
  }
  throw new Error('Could not allocate a Skill Profile version after retrying');
}

export async function markSkillProfileReady(
  profileId: string,
  data: {
    extraction: ExtractedProfile;
    normalizedSkills: NormalizedSkill[];
    extractionModel: string;
  },
): Promise<SkillProfileRecord> {
  const updated = await prisma.skillProfile.update({
    where: { id: profileId },
    data: {
      status: 'READY',
      extraction: data.extraction as unknown as Prisma.InputJsonValue,
      normalizedSkills: data.normalizedSkills as unknown as Prisma.InputJsonValue,
      extractionModel: data.extractionModel,
      errorMessage: null,
    },
  });
  return toSkillProfileRecord(updated);
}

export async function markSkillProfileFailed(
  profileId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.skillProfile.update({
    where: { id: profileId },
    data: { status: 'FAILED', errorMessage },
  });
}

export async function getLatestSkillProfile(
  userId: string,
): Promise<{ profile: SkillProfileRecord; analysis: RoleAnalysisRecord | null } | null> {
  const profile = await prisma.skillProfile.findFirst({
    where: { userId },
    orderBy: { version: 'desc' },
    include: {
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!profile) return null;
  const [latestAnalysis] = profile.analyses;
  return {
    profile: toSkillProfileRecord(profile),
    analysis: latestAnalysis ? toRoleAnalysisRecord(latestAnalysis) : null,
  };
}

export async function getSkillProfileForUser(
  profileId: string,
  userId: string,
): Promise<SkillProfileRecord | null> {
  const profile = await prisma.skillProfile.findFirst({
    where: { id: profileId, userId },
  });
  return profile ? toSkillProfileRecord(profile) : null;
}

export async function createRoleAnalysis(input: {
  profileId: string;
  engineVersion: string;
  selectedRoles: TargetRole[];
  gaps: GapReport;
}): Promise<RoleAnalysisRecord> {
  const created = await prisma.roleAnalysis.create({
    data: {
      profileId: input.profileId,
      engineVersion: input.engineVersion,
      selectedRoles: input.selectedRoles as unknown as Prisma.InputJsonValue,
      gaps: input.gaps as unknown as Prisma.InputJsonValue,
    },
  });
  return toRoleAnalysisRecord(created);
}

export async function deleteSkillProfilesForUser(userId: string): Promise<number> {
  const result = await prisma.skillProfile.deleteMany({ where: { userId } });
  return result.count;
}
