import { createHash } from 'node:crypto';
import type {
  Prisma,
  ProcessingStage as PrismaProcessingStage,
} from '@prisma/client';
import { prisma } from './prisma';

export type SourceType = 'PDF' | 'WEBSITE' | 'TEXT' | 'YOUTUBE' | 'VTT';
export type SourceStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ProcessingStage =
  | 'CREATED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'FETCHING'
  | 'PARSING'
  | 'CHUNKING'
  | 'READY_FOR_INDEXING'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'COMPLETED'
  | 'FAILED';

export interface SourceRecord {
  id: string;
  workspaceId: string;
  title: string;
  type: SourceType;
  status: SourceStatus;
  stage: ProcessingStage;
  currentVersion: number;
  url?: string | null;
  fileSize?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceArtifactInput {
  originalContent?: string | null;
  artifactData?: Uint8Array | null;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  sourceUrl?: string | null;
}

export interface PersistedSourceArtifact {
  id: string;
  sourceId: string;
  version: number;
  originalContent: string | null;
  artifactData: Uint8Array | null;
  artifactFileName: string | null;
  artifactMimeType: string | null;
  artifactSize: number | null;
  sourceUrl: string | null;
  rawContent: string;
  cleanText: string;
  parserMetadata: Record<string, any> | null;
  parserVersion: string;
  checksum: string;
}

export interface RecoveredIngestionAttempt {
  sourceId: string;
  workspaceId: string;
  title: string;
  type: SourceType;
  version: number;
}

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1_000;
const NON_TERMINAL_STAGES: ProcessingStage[] = [
  'CREATED',
  'QUEUED',
  'PROCESSING',
  'FETCHING',
  'PARSING',
  'CHUNKING',
  'READY_FOR_INDEXING',
  'EMBEDDING',
  'INDEXING',
];

const allowedTransitions: Record<ProcessingStage, ProcessingStage[]> = {
  CREATED: ['QUEUED', 'FAILED'],
  QUEUED: ['PROCESSING', 'FAILED'],
  PROCESSING: ['FETCHING', 'PARSING', 'FAILED'],
  FETCHING: ['PARSING', 'FAILED'],
  PARSING: ['CHUNKING', 'FAILED'],
  CHUNKING: ['READY_FOR_INDEXING', 'FAILED'],
  READY_FOR_INDEXING: ['EMBEDDING', 'FAILED'],
  EMBEDDING: ['INDEXING', 'FAILED'],
  INDEXING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
};

const stageProgress: Record<ProcessingStage, number> = {
  CREATED: 0,
  QUEUED: 5,
  PROCESSING: 10,
  FETCHING: 20,
  PARSING: 35,
  CHUNKING: 55,
  READY_FOR_INDEXING: 70,
  EMBEDDING: 80,
  INDEXING: 90,
  COMPLETED: 100,
  FAILED: 0,
};

function calculateChecksum(artifact: SourceArtifactInput): string {
  const hash = createHash('sha256');
  if (artifact.artifactData?.byteLength) {
    hash.update(artifact.artifactData);
  } else {
    hash.update(artifact.originalContent || artifact.sourceUrl || '');
  }
  return hash.digest('hex');
}

export function isProcessingAttemptStale(
  updatedAt: Date,
  staleAfterMs: number,
  now = new Date(),
): boolean {
  return now.getTime() - updatedAt.getTime() >= staleAfterMs;
}

function toSourceRecord(source: {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  status: string;
  stage: string;
  currentVersion: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SourceRecord {
  const metadata = source.metadata as Record<string, any> | null;
  return {
    id: source.id,
    workspaceId: source.workspaceId,
    title: source.title,
    type: source.type as SourceType,
    status: source.status as SourceStatus,
    stage: source.stage as ProcessingStage,
    currentVersion: source.currentVersion,
    url: metadata?.url || null,
    fileSize: metadata?.fileSize || null,
    metadata,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export function assertValidProcessingTransition(
  current: ProcessingStage,
  next: ProcessingStage,
): void {
  if (!allowedTransitions[current]?.includes(next)) {
    throw new Error(`Invalid processing transition: ${current} -> ${next}`);
  }
}

export async function getWorkspaceSources(workspaceId: string): Promise<SourceRecord[]> {
  const records = await prisma.source.findMany({
    where: {
      OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
    },
    orderBy: { createdAt: 'desc' },
  });
  return records.map(toSourceRecord);
}

export async function createSource(data: {
  workspaceId: string;
  title: string;
  type: SourceType;
  url?: string;
  fileSize?: string;
  metadata?: Record<string, any>;
  artifact: SourceArtifactInput;
}): Promise<SourceRecord> {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: data.workspaceId }, { slug: data.workspaceId }] },
    select: { id: true },
  });
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const checksum = calculateChecksum(data.artifact);
  const metadata = {
    ...(data.metadata || {}),
    url: data.url || data.artifact.sourceUrl || null,
    fileSize: data.fileSize || null,
    stage: 'CREATED',
    stageProgress: 0,
    currentVersion: 1,
    errorMessage: null,
    automaticRecoveryCount: 0,
  };

  const created = await prisma.source.create({
    data: {
      workspaceId: workspace.id,
      title: data.title.trim(),
      type: data.type,
      status: 'PENDING',
      stage: 'CREATED',
      currentVersion: 1,
      metadata,
      contents: {
        create: {
          version: 1,
          originalContent: data.artifact.originalContent || null,
          artifactData: data.artifact.artifactData || null,
          artifactFileName: data.artifact.fileName || null,
          artifactMimeType: data.artifact.mimeType || null,
          artifactSize: data.artifact.size ?? null,
          sourceUrl: data.artifact.sourceUrl || data.url || null,
          rawContent: '',
          cleanText: '',
          parserMetadata: null,
          parserVersion: 'pending',
          checksum,
        },
      },
      processingAttempts: {
        create: {
          version: 1,
          stage: 'CREATED',
          events: { create: { stage: 'CREATED' } },
        },
      },
    },
  });

  return toSourceRecord(created);
}

export async function getSourceArtifact(
  sourceId: string,
  version?: number,
): Promise<PersistedSourceArtifact | null> {
  const content = await prisma.sourceContent.findFirst({
    where: {
      sourceId,
      ...(version !== undefined ? { version } : {}),
    },
    orderBy: version === undefined ? { version: 'desc' } : undefined,
  });
  if (!content) return null;

  return {
    id: content.id,
    sourceId: content.sourceId,
    version: content.version,
    originalContent: content.originalContent,
    artifactData: content.artifactData,
    artifactFileName: content.artifactFileName,
    artifactMimeType: content.artifactMimeType,
    artifactSize: content.artifactSize,
    sourceUrl: content.sourceUrl,
    rawContent: content.rawContent,
    cleanText: content.cleanText,
    parserMetadata: content.parserMetadata as Record<string, any> | null,
    parserVersion: content.parserVersion,
    checksum: content.checksum,
  };
}

export async function persistParsedSourceArtifact(data: {
  sourceId: string;
  version: number;
  originalContent: string | null;
  artifactData?: Uint8Array | null;
  artifactFileName?: string | null;
  artifactMimeType?: string | null;
  artifactSize?: number | null;
  sourceUrl?: string | null;
  rawContent: string;
  cleanText: string;
  parserMetadata: Record<string, any>;
  parserVersion: string;
}): Promise<void> {
  const checksum = calculateChecksum({
    originalContent: data.originalContent,
    artifactData: data.artifactData,
    sourceUrl: data.sourceUrl,
  });

  await prisma.sourceContent.update({
    where: {
      sourceId_version: {
        sourceId: data.sourceId,
        version: data.version,
      },
    },
    data: {
      originalContent: data.originalContent,
      artifactData: data.artifactData,
      artifactFileName: data.artifactFileName,
      artifactMimeType: data.artifactMimeType,
      artifactSize: data.artifactSize,
      sourceUrl: data.sourceUrl,
      rawContent: data.rawContent,
      cleanText: data.cleanText,
      parserMetadata: data.parserMetadata,
      parserVersion: data.parserVersion,
      checksum,
      processedAt: new Date(),
    },
  });
}

export async function claimProcessingAttempt(data: {
  sourceId: string;
  version: number;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.sourceProcessingAttempt.findUnique({
      where: {
        sourceId_version: {
          sourceId: data.sourceId,
          version: data.version,
        },
      },
      include: { source: true },
    });
    if (!attempt || attempt.source.currentVersion !== data.version) return false;

    const claimed = await tx.sourceProcessingAttempt.updateMany({
      where: {
        id: attempt.id,
        version: data.version,
        stage: 'CREATED',
        completedAt: null,
      },
      data: {
        stage: 'QUEUED',
        errorMessage: null,
      },
    });
    if (claimed.count !== 1) return false;

    const metadata = (attempt.source.metadata as Record<string, any>) || {};
    const sourceClaimed = await tx.source.updateMany({
      where: { id: data.sourceId, currentVersion: data.version },
      data: {
        status: 'PENDING',
        stage: 'QUEUED',
        metadata: {
          ...metadata,
          stage: 'QUEUED',
          stageProgress: stageProgress.QUEUED,
          currentVersion: data.version,
          errorMessage: null,
          claimedAt: new Date().toISOString(),
        },
      },
    });
    if (sourceClaimed.count !== 1) {
      throw new Error('Source version changed while claiming ingestion');
    }
    await tx.sourceProcessingEvent.create({
      data: {
        attemptId: attempt.id,
        stage: 'QUEUED',
        details: { claim: 'database-cas' },
      },
    });
    return true;
  });
}

export async function touchProcessingAttempt(data: {
  sourceId: string;
  version: number;
  stage: ProcessingStage;
}): Promise<boolean> {
  const touched = await prisma.sourceProcessingAttempt.updateMany({
    where: {
      sourceId: data.sourceId,
      version: data.version,
      stage: data.stage as PrismaProcessingStage,
      completedAt: null,
      source: { currentVersion: data.version },
    },
    data: { updatedAt: new Date() },
  });
  return touched.count === 1;
}

async function createVersionFromArtifact(
  tx: Prisma.TransactionClient,
  input: {
    sourceId: string;
    version: number;
    artifact: {
      originalContent: string | null;
      artifactData: Uint8Array | null;
      artifactFileName: string | null;
      artifactMimeType: string | null;
      artifactSize: number | null;
      sourceUrl: string | null;
      parserMetadata: unknown;
      checksum: string;
    };
  },
): Promise<void> {
  await tx.sourceContent.create({
    data: {
      sourceId: input.sourceId,
      version: input.version,
      originalContent: input.artifact.originalContent,
      artifactData: input.artifact.artifactData,
      artifactFileName: input.artifact.artifactFileName,
      artifactMimeType: input.artifact.artifactMimeType,
      artifactSize: input.artifact.artifactSize,
      sourceUrl: input.artifact.sourceUrl,
      rawContent: '',
      cleanText: '',
      parserMetadata: input.artifact.parserMetadata as Prisma.InputJsonValue | undefined,
      parserVersion: 'pending',
      checksum: input.artifact.checksum,
    },
  });
  await tx.sourceProcessingAttempt.create({
    data: {
      sourceId: input.sourceId,
      version: input.version,
      stage: 'CREATED',
      events: { create: { stage: 'CREATED' } },
    },
  });
}

export async function createReprocessingVersion(
  sourceId: string,
  options: { staleAfterMs?: number } = {},
  database: Pick<typeof prisma, '$transaction'> = prisma,
): Promise<number> {
  return database.$transaction(async (tx) => {
    const source = await tx.source.findUnique({
      where: { id: sourceId },
      include: {
        contents: { orderBy: { version: 'desc' }, take: 1 },
        processingAttempts: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!source || source.contents.length === 0) {
      throw new Error('Persisted original source artifact not found');
    }

    const latestAttempt = source.processingAttempts[0];
    if (
      latestAttempt &&
      latestAttempt.stage !== 'COMPLETED' &&
      latestAttempt.stage !== 'FAILED'
    ) {
      const stale = isProcessingAttemptStale(
        latestAttempt.updatedAt,
        options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS,
      );
      if (!stale) {
        throw new Error('Source is already being processed');
      }
      const interrupted = await tx.sourceProcessingAttempt.updateMany({
        where: {
          id: latestAttempt.id,
          stage: latestAttempt.stage,
          completedAt: null,
          updatedAt: latestAttempt.updatedAt,
        },
        data: {
          stage: 'FAILED',
          errorMessage: 'The previous processing run stopped before it completed.',
          completedAt: new Date(),
        },
      });
      if (interrupted.count !== 1) {
        throw new Error('Source is already being processed');
      }
      await tx.sourceProcessingEvent.create({
        data: {
          attemptId: latestAttempt.id,
          stage: 'FAILED',
          details: {
            errorCode: 'STALE_ATTEMPT_RECOVERED',
            errorCategory: 'STALE_ATTEMPT_RECOVERED',
            failedStage: latestAttempt.stage,
            recovery: 'manual-reprocess',
          },
        },
      });
    }

    const original = source.contents[0];
    const version = source.currentVersion + 1;
    const currentMetadata = (source.metadata as Record<string, any>) || {};
    const advanced = await tx.source.updateMany({
      where: { id: sourceId, currentVersion: source.currentVersion },
      data: {
        currentVersion: version,
        status: 'PENDING',
        stage: 'CREATED',
        metadata: {
          ...currentMetadata,
          currentVersion: version,
          stage: 'CREATED',
          stageProgress: 0,
          errorMessage: null,
          errorCode: null,
          errorCategory: null,
          retryable: null,
          automaticRecoveryCount: 0,
        },
      },
    });
    if (advanced.count !== 1) {
      throw new Error('Source is already being processed');
    }
    await createVersionFromArtifact(tx, {
      sourceId,
      version,
      artifact: original,
    });

    return version;
  });
}

export async function recoverStaleProcessingAttempts(input: {
  staleBefore: Date;
  maxAutomaticRecoveries: number;
  limit?: number;
}): Promise<RecoveredIngestionAttempt[]> {
  const candidates = await prisma.sourceProcessingAttempt.findMany({
    where: {
      completedAt: null,
      stage: { in: NON_TERMINAL_STAGES as PrismaProcessingStage[] },
      updatedAt: { lte: input.staleBefore },
    },
    orderBy: { updatedAt: 'asc' },
    take: input.limit ?? 25,
    select: { id: true },
  });

  const recovered: RecoveredIngestionAttempt[] = [];
  for (const candidate of candidates) {
    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.sourceProcessingAttempt.findUnique({
        where: { id: candidate.id },
        include: { source: true },
      });
      if (
        !attempt ||
        attempt.completedAt ||
        !NON_TERMINAL_STAGES.includes(attempt.stage as ProcessingStage) ||
        attempt.updatedAt > input.staleBefore
      ) {
        return null;
      }

      if (attempt.source.currentVersion !== attempt.version) {
        const obsoleted = await tx.sourceProcessingAttempt.updateMany({
          where: {
            id: attempt.id,
            stage: attempt.stage,
            completedAt: null,
            updatedAt: { lte: input.staleBefore },
          },
          data: {
            stage: 'FAILED',
            errorMessage: 'This processing attempt was superseded by a newer source version.',
            completedAt: new Date(),
          },
        });
        if (obsoleted.count === 1) {
          await tx.sourceProcessingEvent.create({
            data: {
              attemptId: attempt.id,
              stage: 'FAILED',
              details: {
                errorCode: 'STALE_ATTEMPT_RECOVERED',
                errorCategory: 'STALE_ATTEMPT_RECOVERED',
                failedStage: attempt.stage,
                recovery: 'superseded',
                retryable: false,
              },
            },
          });
        }
        return null;
      }

      const artifact = await tx.sourceContent.findUnique({
        where: {
          sourceId_version: {
            sourceId: attempt.sourceId,
            version: attempt.version,
          },
        },
      });
      if (!artifact) {
        const failed = await tx.sourceProcessingAttempt.updateMany({
          where: {
            id: attempt.id,
            stage: attempt.stage,
            completedAt: null,
            updatedAt: { lte: input.staleBefore },
          },
          data: {
            stage: 'FAILED',
            errorMessage: 'The persisted original source artifact is missing.',
            completedAt: new Date(),
          },
        });
        if (failed.count !== 1) return null;
        await tx.sourceProcessingEvent.create({
          data: {
            attemptId: attempt.id,
            stage: 'FAILED',
            details: {
              errorCode: 'SOURCE_ARTIFACT_MISSING',
              errorCategory: 'SOURCE_ARTIFACT_MISSING',
              failedStage: attempt.stage,
              recovery: 'not-possible',
              retryable: false,
            },
          },
        });
        const metadata = (attempt.source.metadata as Record<string, any>) || {};
        await tx.source.updateMany({
          where: { id: attempt.sourceId, currentVersion: attempt.version },
          data: {
            status: 'FAILED',
            stage: 'FAILED',
            metadata: {
              ...metadata,
              stage: 'FAILED',
              stageProgress: 0,
              errorCode: 'SOURCE_ARTIFACT_MISSING',
              errorCategory: 'SOURCE_ARTIFACT_MISSING',
              errorMessage:
                'The original source artifact is missing. Remove and add this source again.',
              retryable: false,
              failedStage: attempt.stage,
              failedAt: new Date().toISOString(),
            },
          },
        });
        return null;
      }

      const claimed = await tx.sourceProcessingAttempt.updateMany({
        where: {
          id: attempt.id,
          stage: attempt.stage,
          completedAt: null,
          updatedAt: { lte: input.staleBefore },
        },
        data: {
          stage: 'FAILED',
          errorMessage: 'Processing stopped before this stage completed.',
          completedAt: new Date(),
        },
      });
      if (claimed.count !== 1) return null;

      const metadata = (attempt.source.metadata as Record<string, any>) || {};
      const recoveryCount = Number(metadata.automaticRecoveryCount || 0);
      const canRecover = recoveryCount < input.maxAutomaticRecoveries;
      await tx.sourceProcessingEvent.create({
        data: {
          attemptId: attempt.id,
          stage: 'FAILED',
          details: {
            errorCode: 'STALE_ATTEMPT_RECOVERED',
            errorCategory: 'STALE_ATTEMPT_RECOVERED',
            failedStage: attempt.stage,
            recovery: canRecover ? 'automatic' : 'exhausted',
            retryable: canRecover,
          },
        },
      });

      if (!canRecover) {
        await tx.source.updateMany({
          where: { id: attempt.sourceId, currentVersion: attempt.version },
          data: {
            status: 'FAILED',
            stage: 'FAILED',
            metadata: {
              ...metadata,
              stage: 'FAILED',
              stageProgress: 0,
              errorCode: 'STALE_ATTEMPT_RECOVERED',
              errorCategory: 'STALE_ATTEMPT_RECOVERED',
              errorMessage:
                'Processing was interrupted repeatedly. Please retry this source manually.',
              retryable: true,
              failedStage: attempt.stage,
              failedAt: new Date().toISOString(),
            },
          },
        });
        return null;
      }

      const version = attempt.version + 1;
      const advanced = await tx.source.updateMany({
        where: { id: attempt.sourceId, currentVersion: attempt.version },
        data: {
          currentVersion: version,
          status: 'PENDING',
          stage: 'CREATED',
          metadata: {
            ...metadata,
            currentVersion: version,
            stage: 'CREATED',
            stageProgress: 0,
            errorMessage: null,
            errorCode: null,
            errorCategory: null,
            retryable: null,
            recoveredFromVersion: attempt.version,
            recoveredFromStage: attempt.stage,
            automaticRecoveryCount: recoveryCount + 1,
            recoveredAt: new Date().toISOString(),
          },
        },
      });
      if (advanced.count !== 1) return null;

      await createVersionFromArtifact(tx, {
        sourceId: attempt.sourceId,
        version,
        artifact,
      });
      return {
        sourceId: attempt.source.id,
        workspaceId: attempt.source.workspaceId,
        title: attempt.source.title,
        type: attempt.source.type as SourceType,
        version,
      };
    });
    if (result) recovered.push(result);
  }
  return recovered;
}

export async function transitionProcessingStage(data: {
  sourceId: string;
  version: number;
  nextStage: ProcessingStage;
  details?: Record<string, any>;
  errorMessage?: string | null;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const attempt = await tx.sourceProcessingAttempt.findUnique({
      where: {
        sourceId_version: {
          sourceId: data.sourceId,
          version: data.version,
        },
      },
      include: { source: true },
    });
    if (!attempt) {
      throw new Error('Processing attempt not found');
    }

    const currentStage = attempt.stage as ProcessingStage;
    assertValidProcessingTransition(currentStage, data.nextStage);

    const terminal = data.nextStage === 'COMPLETED' || data.nextStage === 'FAILED';
    const status: SourceStatus =
      data.nextStage === 'COMPLETED'
        ? 'COMPLETED'
        : data.nextStage === 'FAILED'
          ? 'FAILED'
          : data.nextStage === 'CREATED' || data.nextStage === 'QUEUED'
            ? 'PENDING'
            : 'PROCESSING';
    const sourceMetadata = (attempt.source.metadata as Record<string, any>) || {};
    const metadataWithError = data.nextStage === 'FAILED'
      ? {
          ...sourceMetadata,
          ...(data.details || {}),
          stage: data.nextStage,
          stageProgress: stageProgress[data.nextStage],
          currentVersion: data.version,
          errorMessage: data.errorMessage || null,
          errorCode: data.details?.errorCode || null,
          errorCategory: data.details?.errorCategory || null,
          failedAt: new Date().toISOString(),
        }
      : {
          ...sourceMetadata,
          ...(data.details || {}),
          stage: data.nextStage,
          stageProgress: stageProgress[data.nextStage],
          currentVersion: data.version,
          errorMessage: data.errorMessage || null,
          ...(data.nextStage === 'COMPLETED'
            ? { processedAt: new Date().toISOString() }
            : {}),
        };

    const attemptUpdated = await tx.sourceProcessingAttempt.updateMany({
      where: {
        id: attempt.id,
        stage: currentStage as PrismaProcessingStage,
        completedAt: null,
      },
      data: {
        stage: data.nextStage as PrismaProcessingStage,
        errorMessage: data.errorMessage || null,
        completedAt: terminal ? new Date() : null,
      },
    });
    if (attemptUpdated.count !== 1) {
      throw new Error('Processing attempt stage changed concurrently');
    }
    await tx.sourceProcessingEvent.create({
      data: {
        attemptId: attempt.id,
        stage: data.nextStage as PrismaProcessingStage,
        details: data.details || undefined,
      },
    });
    const sourceUpdated = await tx.source.updateMany({
      where: { id: data.sourceId, currentVersion: data.version },
      data: {
        stage: data.nextStage as PrismaProcessingStage,
        status,
        metadata: metadataWithError,
      },
    });
    if (sourceUpdated.count !== 1) {
      throw new Error('Source version changed during processing transition');
    }

    if (data.nextStage === 'PROCESSING') {
      await tx.sourceContent.update({
        where: {
          sourceId_version: {
            sourceId: data.sourceId,
            version: data.version,
          },
        },
        data: { processingStartedAt: new Date() },
      });
    }
  });
}

export async function updateWorkspaceSource(
  workspaceId: string,
  sourceId: string,
  userId: string,
  data: { title?: string; status?: SourceStatus; metadata?: Record<string, any> },
): Promise<SourceRecord | null> {
  const existing = await prisma.source.findFirst({
    where: {
      id: sourceId,
      workspace: {
        userId,
        OR: [{ id: workspaceId }, { slug: workspaceId }],
      },
    },
  });
  if (!existing) return null;

  const currentMetadata = (existing.metadata as Record<string, any>) || {};
  const updated = await prisma.source.update({
    where: { id: existing.id },
    data: {
      ...(data.title ? { title: data.title.trim() } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.metadata
        ? { metadata: { ...currentMetadata, ...data.metadata } }
        : {}),
    },
  });
  return toSourceRecord(updated);
}

export async function deleteWorkspaceSource(
  workspaceId: string,
  sourceId: string,
  userId: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.source.findFirst({
      where: {
        id: sourceId,
        workspace: {
          userId,
          OR: [{ id: workspaceId }, { slug: workspaceId }],
        },
      },
      select: { id: true },
    });
    if (!source) return false;

    await tx.source.delete({ where: { id: source.id } });
    return true;
  });
}
