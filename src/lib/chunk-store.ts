import { prisma } from './prisma';
import { logger } from './logger';

export interface StoredChunkRecord {
  id: string;
  sourceId: string;
  workspaceId: string;
  content: string;
  tokenCount: number;
  chunkIndex: number;
  embedding?: number[] | null;
  createdAt: string;
}

// In-memory fallback chunk storage when PostgreSQL is not configured
const fallbackChunkStore: StoredChunkRecord[] = [];

export async function saveSourceChunks(
  workspaceId: string,
  sourceId: string,
  chunks: Array<{ content: string; tokenEstimate: number; chunkIndex: number; embedding: number[] }>
): Promise<StoredChunkRecord[]> {
  // First clear any existing chunks for this source to ensure clean reprocessing
  await deleteSourceChunks(sourceId);

  const savedRecords: StoredChunkRecord[] = [];

  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      // Resolve workspace ID if slug passed
      let targetWsId = workspaceId;
      const ws = await prisma.workspace.findFirst({
        where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
      });
      if (ws) {
        targetWsId = ws.id;
      }

      for (const item of chunks) {
        const createdChunk = await prisma.chunk.create({
          data: {
            workspaceId: targetWsId,
            sourceId,
            content: item.content,
            tokenCount: item.tokenEstimate,
            chunkIndex: item.chunkIndex,
          },
        });

        // Store vector embedding using raw query if pgvector is enabled
        if (item.embedding && item.embedding.length > 0) {
          try {
            const vectorStr = `[${item.embedding.join(',')}]`;
            await prisma.$executeRaw`
              UPDATE "Chunk" 
              SET embedding = ${vectorStr}::vector 
              WHERE id = ${createdChunk.id}
            `;
          } catch (vecErr) {
            // Ignore vector extension error gracefully if pgvector syntax isn't active
            logger.warn(`pgvector update bypassed for chunk ${createdChunk.id}`, vecErr);
          }
        }

        savedRecords.push({
          id: createdChunk.id,
          sourceId: createdChunk.sourceId,
          workspaceId: createdChunk.workspaceId,
          content: createdChunk.content,
          tokenCount: createdChunk.tokenCount,
          chunkIndex: createdChunk.chunkIndex,
          embedding: item.embedding,
          createdAt: createdChunk.createdAt.toISOString(),
        });
      }

      return savedRecords;
    }
  } catch (err) {
    logger.warn('Prisma saveSourceChunks failed, using fallback chunk store', err);
  }

  // Fallback in-memory persistence
  for (const item of chunks) {
    const record: StoredChunkRecord = {
      id: `chk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      sourceId,
      workspaceId,
      content: item.content,
      tokenCount: item.tokenEstimate,
      chunkIndex: item.chunkIndex,
      embedding: item.embedding,
      createdAt: new Date().toISOString(),
    };

    fallbackChunkStore.push(record);
    savedRecords.push(record);
  }

  return savedRecords;
}

export async function deleteSourceChunks(sourceId: string): Promise<boolean> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      await prisma.chunk.deleteMany({
        where: { sourceId },
      });
    }
  } catch (err) {
    logger.warn('Prisma deleteSourceChunks failed, pruning fallback store', err);
  }

  // Prune fallback store
  for (let i = fallbackChunkStore.length - 1; i >= 0; i--) {
    if (fallbackChunkStore[i].sourceId === sourceId) {
      fallbackChunkStore.splice(i, 1);
    }
  }

  return true;
}

export async function getWorkspaceChunks(workspaceId: string): Promise<StoredChunkRecord[]> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      const dbChunks = await prisma.chunk.findMany({
        where: {
          OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
        },
        orderBy: { chunkIndex: 'asc' },
      });

      return dbChunks.map((c) => ({
        id: c.id,
        sourceId: c.sourceId,
        workspaceId: c.workspaceId,
        content: c.content,
        tokenCount: c.tokenCount,
        chunkIndex: c.chunkIndex,
        createdAt: c.createdAt.toISOString(),
      }));
    }
  } catch (err) {
    logger.warn('Prisma getWorkspaceChunks failed, returning fallback chunks', err);
  }

  return fallbackChunkStore.filter(
    (c) => c.workspaceId === workspaceId || workspaceId === 'ws_default_main' || workspaceId === 'default-workspace'
  );
}
