import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { createCitation, RAGCitation, RetrievedChunk } from '../retrieval/rag-service';

export interface StoredCitation {
  id: string;
  messageId?: string;
  chunkId: string;
  sourceId: string;
  indexId: string;
  title: string;
  snippet: string;
  kind?: 'DOCUMENT' | 'WEB';
  score?: number | null;
  url: string | null;
  page: number | null;
  timestampStartMs: number | null;
  timestampEndMs: number | null;
  textOrigin: string;
}

export interface StoredMessage {
  id: string;
  workspaceId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  mode: 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';
  status: 'SENDING' | 'SUCCESS' | 'ERROR';
  createdAt: string;
  citations?: StoredCitation[];
}

type CitationInput = Omit<RAGCitation, 'id'>;

function toStoredCitation(citation: {
  id: string;
  messageId: string;
  chunkId: string;
  sourceId: string;
  indexId: string;
  title: string;
  snippet: string;
  kind: string;
  score: number | null;
  sourceUrl: string | null;
  pageNumber: number | null;
  timestampStartMs: number | null;
  timestampEndMs: number | null;
  textOrigin: string;
}): StoredCitation {
  return {
    id: citation.id,
    messageId: citation.messageId,
    chunkId: citation.chunkId,
    sourceId: citation.sourceId,
    indexId: citation.indexId,
    title: citation.title,
    snippet: citation.snippet,
    kind: citation.kind as StoredCitation['kind'],
    score: citation.score,
    url: citation.sourceUrl,
    page: citation.pageNumber,
    timestampStartMs: citation.timestampStartMs,
    timestampEndMs: citation.timestampEndMs,
    textOrigin: citation.textOrigin,
  };
}

export async function getWorkspaceMessages(workspaceId: string): Promise<StoredMessage[]> {
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
    },
    include: {
      citations: {
        where: {
          chunk: {
            workspace: {
              OR: [{ id: workspaceId }, { slug: workspaceId }],
            },
            index: {
              status: 'READY',
              activeForSource: { isNot: null },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map((message) => ({
    id: message.id,
    workspaceId: message.workspaceId,
    role: message.role as StoredMessage['role'],
    content: message.content,
    mode: message.mode as StoredMessage['mode'],
    status: message.status as StoredMessage['status'],
    createdAt: message.createdAt.toISOString(),
    citations: message.citations.map(toStoredCitation),
  }));
}

function validateCitationInput(citation: CitationInput): void {
  if (
    !citation.chunkId ||
    !citation.sourceId ||
    !citation.indexId ||
    !citation.title.trim() ||
    !citation.snippet.trim() ||
    !citation.textOrigin.trim()
  ) {
    throw new Error('Citation provenance is incomplete');
  }
  if (
    !Number.isFinite(citation.score) ||
    citation.score < -1 ||
    citation.score > 1
  ) {
    throw new Error('Citation similarity score is invalid');
  }
  const hasStart = citation.timestampStartMs !== null;
  const hasEnd = citation.timestampEndMs !== null;
  if (
    hasStart !== hasEnd ||
    (hasStart &&
      (!Number.isInteger(citation.timestampStartMs) ||
        !Number.isInteger(citation.timestampEndMs) ||
        citation.timestampStartMs! < 0 ||
        citation.timestampEndMs! < citation.timestampStartMs!))
  ) {
    throw new Error('Citation timestamp range is invalid');
  }
  if (citation.kind === 'WEB' && !citation.url) {
    throw new Error('Website citation URL is required');
  }
  if (citation.page !== null && (!Number.isInteger(citation.page) || citation.page < 1)) {
    throw new Error('Citation page number is invalid');
  }
  if (citation.url) {
    try {
      if (new URL(citation.url).protocol !== 'https:') {
        throw new Error('Citation URL must use HTTPS');
      }
    } catch {
      throw new Error('Citation URL is invalid');
    }
  }
}

export async function createWorkspaceMessage(data: {
  workspaceId: string;
  role: StoredMessage['role'];
  content: string;
  mode?: StoredMessage['mode'];
  status?: StoredMessage['status'];
  citations?: CitationInput[];
}): Promise<StoredMessage> {
  return prisma.$transaction(
    async (tx) => {
      const workspace = await tx.workspace.findFirst({
        where: { OR: [{ id: data.workspaceId }, { slug: data.workspaceId }] },
        select: { id: true },
      });
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const citations = data.citations || [];
      citations.forEach(validateCitationInput);
      const uniqueChunkIds = [...new Set(citations.map((citation) => citation.chunkId))];
      if (uniqueChunkIds.length !== citations.length) {
        throw new Error('Duplicate citation chunks are not allowed');
      }

      if (citations.length > 0) {
        const eligibleChunks = await tx.$queryRaw<
          Array<{
            chunkId: string;
            sourceId: string;
            workspaceId: string;
            indexId: string;
            sourceVersion: number;
            content: string;
            tokenCount: number;
            chunkIndex: number;
            title: string;
            sourceType: RetrievedChunk['sourceType'];
            sourceUrl: string | null;
            parserMetadata: Record<string, unknown> | null;
            sourceCleanText: string;
          }>
        >`
          SELECT
            chunk.id AS "chunkId",
            source.id AS "sourceId",
            chunk."workspaceId",
            source_index.id AS "indexId",
            source_index."sourceVersion",
            chunk.content,
            chunk."tokenCount",
            chunk."chunkIndex",
            source.title,
            source.type::text AS "sourceType",
            source_content."sourceUrl",
            source_content."parserMetadata",
            source_content."cleanText" AS "sourceCleanText"
          FROM "Chunk" chunk
          INNER JOIN "Source" source
            ON source.id = chunk."sourceId"
            AND source."activeIndexId" = chunk."indexId"
          INNER JOIN "SourceIndex" source_index
            ON source_index.id = chunk."indexId"
            AND source_index.status = 'READY'::"SourceIndexStatus"
          INNER JOIN "SourceContent" source_content
            ON source_content."sourceId" = source.id
            AND source_content.version = source_index."sourceVersion"
          WHERE chunk."workspaceId" = ${workspace.id}
            AND chunk.id IN (${Prisma.join(uniqueChunkIds)})
            AND chunk."sourceVersion" = source_index."sourceVersion"
          FOR SHARE OF chunk, source, source_index
        `;
        const eligibleById = new Map(eligibleChunks.map((chunk) => [chunk.chunkId, chunk]));
        for (const citation of citations) {
          const eligible = eligibleById.get(citation.chunkId);
          if (!eligible) {
            throw new Error(
              'Citation references an inactive, missing, stale, or cross-Workspace chunk',
            );
          }
          const canonical = createCitation({
            id: eligible.chunkId,
            sourceId: eligible.sourceId,
            workspaceId: eligible.workspaceId,
            indexId: eligible.indexId,
            sourceVersion: eligible.sourceVersion,
            content: eligible.content,
            tokenCount: eligible.tokenCount,
            chunkIndex: eligible.chunkIndex,
            similarity: citation.score,
            sourceTitle: eligible.title,
            sourceType: eligible.sourceType,
            sourceUrl: eligible.sourceUrl,
            parserMetadata: eligible.parserMetadata,
            sourceCleanText: eligible.sourceCleanText,
          });
          const matchesCanonicalProvenance =
            canonical.chunkId === citation.chunkId &&
            canonical.sourceId === citation.sourceId &&
            canonical.indexId === citation.indexId &&
            canonical.title === citation.title &&
            canonical.snippet === citation.snippet &&
            canonical.kind === citation.kind &&
            canonical.url === citation.url &&
            canonical.page === citation.page &&
            canonical.timestampStartMs === citation.timestampStartMs &&
            canonical.timestampEndMs === citation.timestampEndMs &&
            canonical.textOrigin === citation.textOrigin;
          if (!matchesCanonicalProvenance) {
            throw new Error('Citation provenance does not match its indexed chunk');
          }
        }
      }

      const created = await tx.message.create({
        data: {
          workspaceId: workspace.id,
          role: data.role,
          content: data.content,
          mode: data.mode || 'DETAILED',
          status: data.status || 'SUCCESS',
          citations:
            citations.length > 0
              ? {
                  create: citations.map((citation) => ({
                    title: citation.title,
                    snippet: citation.snippet,
                    kind: citation.kind,
                    score: citation.score,
                    chunkId: citation.chunkId,
                    sourceId: citation.sourceId,
                    indexId: citation.indexId,
                    sourceUrl: citation.url,
                    pageNumber: citation.page,
                    timestampStartMs: citation.timestampStartMs,
                    timestampEndMs: citation.timestampEndMs,
                    textOrigin: citation.textOrigin,
                  })),
                }
              : undefined,
        },
        include: { citations: true },
      });

      return {
        id: created.id,
        workspaceId: created.workspaceId,
        role: created.role as StoredMessage['role'],
        content: created.content,
        mode: created.mode as StoredMessage['mode'],
        status: created.status as StoredMessage['status'],
        createdAt: created.createdAt.toISOString(),
        citations: created.citations.map(toStoredCitation),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}

export async function clearWorkspaceMessages(workspaceId: string): Promise<boolean> {
  await prisma.message.deleteMany({
    where: {
      OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
    },
  });
  return true;
}
