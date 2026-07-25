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

export async function saveSourceChunks(
  workspaceId: string,
  sourceId: string,
  chunks: Array<{ content: string; tokenEstimate: number; chunkIndex: number; embedding: number[] }>,
): Promise<StoredChunkRecord[]> {
  await deleteSourceChunks(sourceId);

  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
    select: { id: true },
  });
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const savedRecords: StoredChunkRecord[] = [];
  for (const item of chunks) {
    const createdChunk = await prisma.chunk.create({
      data: {
        workspaceId: workspace.id,
        sourceId,
        content: item.content,
        tokenCount: item.tokenEstimate,
        chunkIndex: item.chunkIndex,
      },
    });

    if (item.embedding && item.embedding.length > 0) {
      try {
        const vectorString = `[${item.embedding.join(',')}]`;
        await prisma.$executeRaw`
          UPDATE "Chunk"
          SET embedding = ${vectorString}::vector
          WHERE id = ${createdChunk.id}
        `;
      } catch (error) {
        logger.warn(`pgvector update bypassed for chunk ${createdChunk.id}`, error);
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

export async function deleteSourceChunks(sourceId: string): Promise<boolean> {
  await prisma.chunk.deleteMany({ where: { sourceId } });
  return true;
}

export async function getWorkspaceChunks(workspaceId: string): Promise<StoredChunkRecord[]> {
  const chunks = await prisma.chunk.findMany({
    where: {
      OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
    },
    orderBy: { chunkIndex: 'asc' },
  });

  return chunks.map((chunk) => ({
    id: chunk.id,
    sourceId: chunk.sourceId,
    workspaceId: chunk.workspaceId,
    content: chunk.content,
    tokenCount: chunk.tokenCount,
    chunkIndex: chunk.chunkIndex,
    createdAt: chunk.createdAt.toISOString(),
  }));
}
