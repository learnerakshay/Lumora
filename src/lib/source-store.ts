import { prisma } from './prisma';
import { logger } from './logger';

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

// In-memory fallback store
const fallbackSources: SourceRecord[] = [
  {
    id: 'src_default_1',
    workspaceId: 'ws_default_main',
    title: 'Lumora System Architecture & Vector Schema Specs.pdf',
    type: 'PDF',
    status: 'COMPLETED',
    fileSize: '2.4 MB',
    metadata: {
      author: 'Lumora Engineering',
      pages: 12,
      stage: 'INDEXED',
      stageProgress: 100,
      chunkCount: 14,
      tokenCount: 4200,
      fileSize: '2.4 MB',
      processedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    },
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  },
  {
    id: 'src_default_2',
    workspaceId: 'ws_default_main',
    title: 'https://docs.lumora.ai/knowledge-operating-system',
    type: 'WEBSITE',
    status: 'COMPLETED',
    url: 'https://docs.lumora.ai/knowledge-operating-system',
    fileSize: '480 KB',
    metadata: {
      domain: 'docs.lumora.ai',
      url: 'https://docs.lumora.ai/knowledge-operating-system',
      stage: 'INDEXED',
      stageProgress: 100,
      chunkCount: 6,
      tokenCount: 1850,
      fileSize: '480 KB',
      processedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'src_default_3',
    workspaceId: 'ws_default_main',
    title: 'PostgreSQL pgvector Query Tuning & Indexing Guidelines',
    type: 'TEXT',
    status: 'COMPLETED',
    fileSize: '18 KB',
    metadata: {
      characters: 14200,
      stage: 'INDEXED',
      stageProgress: 100,
      chunkCount: 12,
      tokenCount: 3550,
      fileSize: '18 KB',
      processedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

export async function getWorkspaceSources(workspaceId: string): Promise<SourceRecord[]> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      const records = await prisma.source.findMany({
        where: {
          OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map((s) => {
        const meta = s.metadata as Record<string, any> | null;
        return {
          id: s.id,
          workspaceId: s.workspaceId,
          title: s.title,
          type: s.type as SourceType,
          status: s.status as SourceStatus,
          url: meta?.url || null,
          fileSize: meta?.fileSize || null,
          metadata: meta,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        };
      });
    }
  } catch (err) {
    logger.warn('Prisma getWorkspaceSources failed, using fallback sources', err);
  }

  return fallbackSources.filter(
    (s) => s.workspaceId === workspaceId || workspaceId === 'ws_default_main' || workspaceId === 'default-workspace'
  );
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
  const status = data.status || 'COMPLETED';
  const metadata = {
    ...(data.metadata || {}),
    url: data.url || null,
    fileSize: data.fileSize || null,
    rawContentSnippet: data.rawContent ? data.rawContent.substring(0, 300) : null,
  };

  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      // Resolve actual workspace ID if slug passed
      let targetWsId = data.workspaceId;
      const ws = await prisma.workspace.findFirst({
        where: { OR: [{ id: data.workspaceId }, { slug: data.workspaceId }] },
      });
      if (ws) {
        targetWsId = ws.id;
      }

      const created = await prisma.source.create({
        data: {
          workspaceId: targetWsId,
          title: data.title.trim(),
          type: data.type,
          status,
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

      return {
        id: created.id,
        workspaceId: created.workspaceId,
        title: created.title,
        type: created.type as SourceType,
        status: created.status as SourceStatus,
        url: data.url || null,
        fileSize: data.fileSize || null,
        metadata,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    }
  } catch (err) {
    logger.warn('Prisma createSource failed, using fallback sources', err);
  }

  const newSource: SourceRecord = {
    id: `src_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
    workspaceId: data.workspaceId,
    title: data.title.trim(),
    type: data.type,
    status,
    url: data.url || null,
    fileSize: data.fileSize || null,
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fallbackSources.unshift(newSource);
  return newSource;
}

export async function updateSource(
  id: string,
  data: { title?: string; status?: SourceStatus; metadata?: Record<string, any> }
): Promise<SourceRecord | null> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      const existing = await prisma.source.findUnique({ where: { id } });
      const currentMeta = (existing?.metadata as Record<string, any>) || {};
      const mergedMeta = data.metadata ? { ...currentMeta, ...data.metadata } : currentMeta;

      const updated = await prisma.source.update({
        where: { id },
        data: {
          ...(data.title ? { title: data.title.trim() } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(data.metadata ? { metadata: mergedMeta } : {}),
          updatedAt: new Date(),
        },
      });

      const meta = updated.metadata as Record<string, any> | null;
      return {
        id: updated.id,
        workspaceId: updated.workspaceId,
        title: updated.title,
        type: updated.type as SourceType,
        status: updated.status as SourceStatus,
        url: meta?.url || null,
        fileSize: meta?.fileSize || null,
        metadata: meta,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    }
  } catch (err) {
    logger.warn('Prisma updateSource failed, updating fallback sources', err);
  }

  const idx = fallbackSources.findIndex((s) => s.id === id);
  if (idx !== -1) {
    const current = fallbackSources[idx];
    const mergedMeta = data.metadata ? { ...(current.metadata || {}), ...data.metadata } : current.metadata;
    const updated: SourceRecord = {
      ...current,
      title: data.title ? data.title.trim() : current.title,
      status: data.status ? data.status : current.status,
      metadata: mergedMeta,
      updatedAt: new Date().toISOString(),
    };
    fallbackSources[idx] = updated;
    return updated;
  }

  return null;
}

export async function deleteSource(id: string): Promise<boolean> {
  let deleted = false;
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      await prisma.source.delete({
        where: { id },
      });
      deleted = true;
    }
  } catch (err) {
    logger.warn('Prisma deleteSource failed, removing from fallback sources', err);
  }

  const idx = fallbackSources.findIndex((s) => s.id === id);
  if (idx !== -1) {
    fallbackSources.splice(idx, 1);
    deleted = true;
  }

  return deleted;
}
