import { randomUUID } from 'node:crypto';
import { Prisma, SourceIndexStatus } from '@prisma/client';
import { prisma } from './prisma';
import {
  EmbeddingContract,
  validateEmbeddingVector,
} from './ingestion/embedder';

export interface StoredChunkRecord {
  id: string;
  sourceId: string;
  workspaceId: string;
  content: string;
  tokenCount: number;
  chunkIndex: number;
  createdAt: string;
}

export interface SourceIndexCommit {
  indexId: string;
  sourceVersion: number;
  chunkVersion: string;
  chunkCount: number;
  indexedAt: string;
  chunks: StoredChunkRecord[];
}

interface IndexChunkInput {
  content: string;
  tokenEstimate: number;
  chunkIndex: number;
  embedding: number[];
}

export interface SaveSourceIndexInput {
  workspaceId: string;
  sourceId: string;
  sourceVersion: number;
  chunkVersion: string;
  contract: EmbeddingContract;
  chunks: IndexChunkInput[];
  completion?: {
    pipelineStartedAt: number;
    details: Record<string, unknown>;
  };
}

type VectorDatabaseClient = Pick<typeof prisma, '$queryRaw' | '$transaction'>;

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

function validateIndexInput(input: SaveSourceIndexInput): void {
  if (!Number.isInteger(input.sourceVersion) || input.sourceVersion < 1) {
    throw new Error('Source index version must be a positive integer');
  }
  if (!input.chunkVersion.trim()) {
    throw new Error('Chunk version is required');
  }
  if (input.chunks.length === 0) {
    throw new Error('A source index must contain at least one chunk');
  }

  const indexes = new Set<number>();
  input.chunks.forEach((chunk, position) => {
    if (!chunk.content.trim()) {
      throw new Error(`Chunk ${position} has empty content`);
    }
    if (!Number.isInteger(chunk.chunkIndex) || chunk.chunkIndex < 0) {
      throw new Error(`Chunk ${position} has an invalid chunk index`);
    }
    if (indexes.has(chunk.chunkIndex)) {
      throw new Error(`Duplicate chunk index ${chunk.chunkIndex}`);
    }
    indexes.add(chunk.chunkIndex);
    validateEmbeddingVector(chunk.embedding, input.contract, `chunk ${chunk.chunkIndex} embedding`);
  });
}

export async function assertPgvectorAvailable(
  database: Pick<typeof prisma, '$queryRaw'> = prisma,
): Promise<string> {
  const rows = await database.$queryRaw<Array<{ extversion: string }>>`
    SELECT extversion
    FROM pg_extension
    WHERE extname = 'vector'
  `;
  if (rows.length !== 1 || !rows[0].extversion) {
    throw new Error('pgvector extension is not available');
  }
  return rows[0].extversion;
}

export async function saveSourceIndex(
  input: SaveSourceIndexInput,
  database: VectorDatabaseClient = prisma,
): Promise<SourceIndexCommit> {
  validateIndexInput(input);
  await assertPgvectorAvailable(database);

  return database.$transaction(
    async (tx) => {
      let processingAttempt: {
        id: string;
        stage: string;
        completedAt: Date | null;
      } | null = null;
      if (input.completion) {
        const attempts = await tx.$queryRaw<Array<{
          id: string;
          stage: string;
          completedAt: Date | null;
        }>>`
          SELECT id, stage::text, "completedAt"
          FROM "SourceProcessingAttempt"
          WHERE "sourceId" = ${input.sourceId}
            AND version = ${input.sourceVersion}
          FOR UPDATE
        `;
        processingAttempt = attempts[0] || null;
        if (
          !processingAttempt ||
          processingAttempt.stage !== 'INDEXING' ||
          processingAttempt.completedAt
        ) {
          throw new Error('Processing attempt no longer owns index promotion');
        }
      }

      const sources = await tx.$queryRaw<
        Array<{
          id: string;
          workspaceId: string;
          activeIndexId: string | null;
          currentVersion: number;
          metadata: unknown;
        }>
      >`
        SELECT
          source.id,
          source."workspaceId",
          source."activeIndexId",
          source."currentVersion",
          source.metadata
        FROM "Source" source
        INNER JOIN "Workspace" workspace ON workspace.id = source."workspaceId"
        WHERE source.id = ${input.sourceId}
          AND (workspace.id = ${input.workspaceId} OR workspace.slug = ${input.workspaceId})
        FOR UPDATE
      `;
      const source = sources[0];
      if (!source) {
        throw new Error('Source was not found in the requested Workspace');
      }
      if (source.currentVersion !== input.sourceVersion) {
        throw new Error(
          `Source version changed during indexing (expected ${input.sourceVersion}, current ${source.currentVersion})`,
        );
      }

      const createdIndex = await tx.sourceIndex.create({
        data: {
          sourceId: source.id,
          sourceVersion: input.sourceVersion,
          chunkVersion: input.chunkVersion,
          expectedChunkCount: input.chunks.length,
          embeddingProvider: input.contract.provider,
          embeddingModel: input.contract.model,
          embeddingVersion: input.contract.version,
          vectorDimensions: input.contract.dimensions,
          status: SourceIndexStatus.BUILDING,
        },
        select: { id: true },
      });

      const createdAt = new Date();
      const records: StoredChunkRecord[] = [];
      for (const chunk of input.chunks) {
        const id = randomUUID();
        const affected = await tx.$executeRaw`
          INSERT INTO "Chunk" (
            id,
            "sourceId",
            "workspaceId",
            "indexId",
            "sourceVersion",
            content,
            "tokenCount",
            "chunkIndex",
            embedding,
            "createdAt"
          )
          VALUES (
            ${id},
            ${source.id},
            ${source.workspaceId},
            ${createdIndex.id},
            ${input.sourceVersion},
            ${chunk.content},
            ${chunk.tokenEstimate},
            ${chunk.chunkIndex},
            ${vectorLiteral(chunk.embedding)}::vector,
            ${createdAt}
          )
        `;
        if (affected !== 1) {
          throw new Error(`pgvector insert failed for chunk ${chunk.chunkIndex}`);
        }
        records.push({
          id,
          sourceId: source.id,
          workspaceId: source.workspaceId,
          content: chunk.content,
          tokenCount: chunk.tokenEstimate,
          chunkIndex: chunk.chunkIndex,
          createdAt: createdAt.toISOString(),
        });
      }

      const verification = await tx.$queryRaw<
        Array<{ total: bigint; valid: bigint }>
      >`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (
            WHERE embedding IS NOT NULL
              AND vector_dims(embedding) = ${input.contract.dimensions}
          )::bigint AS valid
        FROM "Chunk"
        WHERE "indexId" = ${createdIndex.id}
      `;
      const total = Number(verification[0]?.total ?? 0);
      const valid = Number(verification[0]?.valid ?? 0);
      if (total !== input.chunks.length || valid !== input.chunks.length) {
        throw new Error(
          `Index verification failed: expected ${input.chunks.length} vectors, stored ${total}, valid ${valid}`,
        );
      }

      if (source.activeIndexId) {
        const superseded = await tx.sourceIndex.updateMany({
          where: {
            id: source.activeIndexId,
            sourceId: source.id,
            status: SourceIndexStatus.READY,
          },
          data: { status: SourceIndexStatus.SUPERSEDED },
        });
        if (superseded.count !== 1) {
          throw new Error('The previous active index is not a valid READY index');
        }
      }

      const indexedAt = new Date();
      await tx.sourceIndex.update({
        where: { id: createdIndex.id },
        data: {
          status: SourceIndexStatus.READY,
          indexedAt,
        },
      });
      const completionDetails = input.completion
        ? {
            ...input.completion.details,
            chunkCount: records.length,
            indexId: createdIndex.id,
            indexedAt: indexedAt.toISOString(),
            sourceVersion: input.sourceVersion,
            chunkVersion: input.chunkVersion,
            embeddingProvider: input.contract.provider,
            embeddingModel: input.contract.model,
            embeddingVersion: input.contract.version,
            vectorDimensions: input.contract.dimensions,
            totalDurationMs: Date.now() - input.completion.pipelineStartedAt,
          }
        : null;

      if (input.completion && processingAttempt && completionDetails) {
        const attemptUpdated = await tx.sourceProcessingAttempt.updateMany({
          where: {
            id: processingAttempt.id,
            stage: 'INDEXING',
            completedAt: null,
          },
          data: {
            stage: 'COMPLETED',
            errorMessage: null,
            completedAt: new Date(),
          },
        });
        if (attemptUpdated.count !== 1) {
          throw new Error('Processing attempt lost ownership during index promotion');
        }
        await tx.sourceProcessingEvent.create({
          data: {
            attemptId: processingAttempt.id,
            stage: 'COMPLETED',
            details: completionDetails,
          },
        });
      }

      const sourceMetadata = source.metadata &&
        typeof source.metadata === 'object' &&
        !Array.isArray(source.metadata)
        ? source.metadata as Record<string, unknown>
        : {};
      await tx.source.update({
        where: { id: source.id },
        data: input.completion && completionDetails
          ? {
              activeIndexId: createdIndex.id,
              status: 'COMPLETED',
              stage: 'COMPLETED',
              metadata: {
                ...sourceMetadata,
                ...completionDetails,
                stage: 'COMPLETED',
                stageProgress: 100,
                currentVersion: input.sourceVersion,
                errorMessage: null,
                errorCode: null,
                errorCategory: null,
                retryable: null,
                failedAt: null,
                failedStage: null,
                processedAt: indexedAt.toISOString(),
              },
            }
          : { activeIndexId: createdIndex.id },
      });

      return {
        indexId: createdIndex.id,
        sourceVersion: input.sourceVersion,
        chunkVersion: input.chunkVersion,
        chunkCount: records.length,
        indexedAt: indexedAt.toISOString(),
        chunks: records,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 120_000,
    },
  );
}

export async function deleteSourceChunks(sourceId: string): Promise<boolean> {
  await prisma.$transaction(async (tx) => {
    await tx.source.update({
      where: { id: sourceId },
      data: { activeIndexId: null },
    });
    await tx.sourceIndex.deleteMany({ where: { sourceId } });
    await tx.chunk.deleteMany({ where: { sourceId, indexId: null } });
  });
  return true;
}

export async function getWorkspaceChunks(workspaceId: string): Promise<StoredChunkRecord[]> {
  const chunks = await prisma.$queryRaw<
    Array<{
      id: string;
      sourceId: string;
      workspaceId: string;
      content: string;
      tokenCount: number;
      chunkIndex: number;
      createdAt: Date;
    }>
  >`
    SELECT
      chunk.id,
      chunk."sourceId",
      chunk."workspaceId",
      chunk.content,
      chunk."tokenCount",
      chunk."chunkIndex",
      chunk."createdAt"
    FROM "Chunk" chunk
    INNER JOIN "Source" source
      ON source.id = chunk."sourceId"
      AND source."activeIndexId" = chunk."indexId"
    INNER JOIN "SourceIndex" source_index
      ON source_index.id = chunk."indexId"
      AND source_index.status = 'READY'::"SourceIndexStatus"
    INNER JOIN "Workspace" workspace ON workspace.id = chunk."workspaceId"
    WHERE workspace.id = ${workspaceId} OR workspace.slug = ${workspaceId}
    ORDER BY chunk."sourceId", chunk."chunkIndex"
  `;

  return chunks.map((chunk) => ({
    ...chunk,
    createdAt: chunk.createdAt.toISOString(),
  }));
}
