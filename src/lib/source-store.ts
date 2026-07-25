import { prisma } from './prisma';

export type SourceType = 'PDF' | 'WEBSITE' | 'TEXT' | 'YOUTUBE' | 'VTT';
export type SourceStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface SourceRecord {
  id: string;
  workspaceId: string;
  title: string;
  type: SourceType;
  status: SourceStatus;
  url?: string | null;
  fileSize?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

function toSourceRecord(source: {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  status: string;
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
    url: metadata?.url || null,
    fileSize: metadata?.fileSize || null,
    metadata,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

async function resolveWorkspaceId(workspaceId: string): Promise<string | null> {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
    select: { id: true },
  });
  return workspace?.id ?? null;
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
  status?: SourceStatus;
  url?: string;
  fileSize?: string;
  rawContent?: string;
  metadata?: Record<string, any>;
}): Promise<SourceRecord> {
  const targetWorkspaceId = await resolveWorkspaceId(data.workspaceId);
  if (!targetWorkspaceId) {
    throw new Error('Workspace not found');
  }

  const metadata = {
    ...(data.metadata || {}),
    url: data.url || null,
    fileSize: data.fileSize || null,
    rawContentSnippet: data.rawContent ? data.rawContent.substring(0, 300) : null,
  };

  const created = await prisma.source.create({
    data: {
      workspaceId: targetWorkspaceId,
      title: data.title.trim(),
      type: data.type,
      status: data.status || 'COMPLETED',
      metadata,
      ...(data.rawContent
        ? {
            contents: {
              create: {
                rawContent: data.rawContent,
                cleanText: data.rawContent.trim(),
              },
            },
          }
        : {}),
    },
  });

  return toSourceRecord(created);
}

export async function updateSource(
  id: string,
  data: { title?: string; status?: SourceStatus; metadata?: Record<string, any> },
): Promise<SourceRecord | null> {
  const existing = await prisma.source.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  const currentMetadata = (existing.metadata as Record<string, any>) || {};
  const updated = await prisma.source.update({
    where: { id },
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

  if (!existing) {
    return null;
  }

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

    if (!source) {
      return false;
    }

    await tx.source.delete({ where: { id: source.id } });
    return true;
  });
}
