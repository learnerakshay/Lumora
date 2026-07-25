import { createHash } from 'node:crypto';
import type { ProcessingStage as PrismaProcessingStage } from '@prisma/client';
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

export async function createReprocessingVersion(sourceId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
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
      throw new Error('Source is already being processed');
    }

    const original = source.contents[0];
    const version = source.currentVersion + 1;
    await tx.sourceContent.create({
      data: {
        sourceId,
        version,
        originalContent: original.originalContent,
        artifactData: original.artifactData,
        artifactFileName: original.artifactFileName,
        artifactMimeType: original.artifactMimeType,
        artifactSize: original.artifactSize,
        sourceUrl: original.sourceUrl,
        rawContent: '',
        cleanText: '',
        parserMetadata: original.parserMetadata,
        parserVersion: 'pending',
        checksum: original.checksum,
      },
    });
    await tx.sourceProcessingAttempt.create({
      data: {
        sourceId,
        version,
        stage: 'CREATED',
        events: { create: { stage: 'CREATED' } },
      },
    });

    const currentMetadata = (source.metadata as Record<string, any>) || {};
    await tx.source.update({
      where: { id: sourceId },
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
        },
      },
    });

    return version;
  });
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

    await tx.sourceProcessingAttempt.update({
      where: { id: attempt.id },
      data: {
        stage: data.nextStage as PrismaProcessingStage,
        errorMessage: data.errorMessage || null,
        completedAt: terminal ? new Date() : null,
        events: {
          create: {
            stage: data.nextStage as PrismaProcessingStage,
            details: data.details || undefined,
          },
        },
      },
    });
    await tx.source.update({
      where: { id: data.sourceId },
      data: {
        stage: data.nextStage as PrismaProcessingStage,
        status,
        metadata: {
          ...sourceMetadata,
          ...(data.details || {}),
          stage: data.nextStage,
          stageProgress: stageProgress[data.nextStage],
          currentVersion: data.version,
          errorMessage: data.errorMessage || null,
          ...(data.nextStage === 'COMPLETED'
            ? { processedAt: new Date().toISOString() }
            : {}),
          ...(data.nextStage === 'FAILED'
            ? { failedAt: new Date().toISOString() }
            : {}),
        },
      },
    });

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
