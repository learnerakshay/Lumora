import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { createCitation, RAGCitation, RetrievedChunk } from '../retrieval/rag-service';
import type { AIActionRequest } from '../ai/actions/types';
import { isChatResponseMode, type ChatResponseMode } from '../../types';
import type { LearningResourceRecommendation } from '../resources/domain';

export interface StoredCitation {
  id: string;
  messageId?: string;
  chunkId: string;
  sourceId: string;
  indexId: string;
  sourceVersion: number;
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
  parentMessageId: string | null;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  mode: 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';
  responseMode: ChatResponseMode | null;
  status: 'SENDING' | 'SUCCESS' | 'ERROR';
  action?: AIActionRequest | null;
  resourceRecommendations?: LearningResourceRecommendation[];
  createdAt: string;
  citations?: StoredCitation[];
}

export function normalizeChatResponseMode(value: unknown): ChatResponseMode | null {
  return isChatResponseMode(value) ? value : null;
}

type CitationInput = Omit<RAGCitation, 'id'>;

export class CitationTrustError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'CITATION_VALIDATION_FAILED'
      | 'CITATION_PROVENANCE_MISMATCH',
  ) {
    super(message);
    this.name = 'CitationTrustError';
  }
}

export const historicalCitationInclude = {
  include: { index: { select: { sourceVersion: true } } },
} as const;

export function toStoredCitation(citation: {
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
  index: { sourceVersion: number };
}): StoredCitation {
  return {
    id: citation.id,
    messageId: citation.messageId,
    chunkId: citation.chunkId,
    sourceId: citation.sourceId,
    indexId: citation.indexId,
    sourceVersion: citation.index.sourceVersion,
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

function toStoredMessage(message: {
  id: string;
  workspaceId: string;
  parentMessageId: string | null;
  role: string;
  content: string;
  mode: string;
  responseMode: string | null;
  resourceRecommendations: Prisma.JsonValue | null;
  status: string;
  action: Prisma.JsonValue | null;
  createdAt: Date;
  citations: Parameters<typeof toStoredCitation>[0][];
}): StoredMessage {
  return {
    id: message.id,
    workspaceId: message.workspaceId,
    parentMessageId: message.parentMessageId,
    role: message.role as StoredMessage['role'],
    content: message.content,
    mode: message.mode as StoredMessage['mode'],
    responseMode: normalizeChatResponseMode(message.responseMode),
    resourceRecommendations: normalizeResourceRecommendations(
      message.resourceRecommendations,
    ),
    status: message.status as StoredMessage['status'],
    action: message.action as unknown as AIActionRequest | null,
    createdAt: message.createdAt.toISOString(),
    citations: message.citations.map(toStoredCitation),
  };
}

function normalizeResourceRecommendations(
  value: Prisma.JsonValue | null,
): LearningResourceRecommendation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, Prisma.JsonValue>;
    if (
      typeof item.id !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.creator !== 'string' ||
      typeof item.provider !== 'string' ||
      typeof item.platform !== 'string' ||
      typeof item.type !== 'string' ||
      typeof item.url !== 'string' ||
      typeof item.reason !== 'string' ||
      typeof item.level !== 'string' ||
      typeof item.accessType !== 'string' ||
      !['YouTube', 'Udemy', 'Cohort', 'Website'].includes(item.platform) ||
      !['video', 'playlist', 'course', 'cohort', 'digital-product', 'article', 'docs'].includes(item.type) ||
      !['beginner', 'intermediate', 'advanced'].includes(item.level) ||
      !['free', 'paid'].includes(item.accessType) ||
      (item.language !== undefined && !['hi', 'en', 'mixed'].includes(String(item.language))) ||
      (item.deliveryMode !== undefined && !['LIVE', 'RECORDED'].includes(String(item.deliveryMode)))
    ) return [];
    try {
      if (new URL(item.url).protocol !== 'https:') return [];
    } catch {
      return [];
    }
    const normalized = { ...item } as unknown as LearningResourceRecommendation;
    if (item.offer !== undefined) {
      if (!item.offer || typeof item.offer !== 'object' || Array.isArray(item.offer)) {
        delete normalized.offer;
      } else {
        const offer = item.offer as Record<string, Prisma.JsonValue>;
        try {
          if (typeof offer.url !== 'string' ||
              typeof offer.label !== 'string' ||
              new URL(offer.url).protocol !== 'https:') {
            delete normalized.offer;
          }
        } catch {
          delete normalized.offer;
        }
      }
    }
    return [normalized];
  });
}

export async function getWorkspaceMessages(workspaceId: string): Promise<StoredMessage[]> {
  const staleGenerationCutoff = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.$transaction([
    prisma.message.updateMany({
      where: {
        OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
        role: 'ASSISTANT',
        status: 'SENDING',
        regenerationStartedAt: null,
        createdAt: { lt: staleGenerationCutoff },
      },
      data: {
        status: 'ERROR',
        content: 'Response generation was interrupted before completion.',
      },
    }),
    prisma.message.updateMany({
      where: {
        OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
        role: 'ASSISTANT',
        status: 'SENDING',
        regenerationStartedAt: { lt: staleGenerationCutoff },
      },
      data: {
        status: 'SUCCESS',
        regenerationStartedAt: null,
      },
    }),
  ]);
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
    },
    include: {
      // Persisted citations are historical provenance. Current retrieval
      // eligibility was enforced transactionally when they were created.
      citations: {
        ...historicalCitationInclude,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map(toStoredMessage);
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
    throw new CitationTrustError(
      'Citation provenance is incomplete',
      'CITATION_VALIDATION_FAILED',
    );
  }
  if (
    !Number.isFinite(citation.score) ||
    citation.score < -1 ||
    citation.score > 1
  ) {
    throw new CitationTrustError(
      'Citation similarity score is invalid',
      'CITATION_VALIDATION_FAILED',
    );
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
    throw new CitationTrustError(
      'Citation timestamp range is invalid',
      'CITATION_VALIDATION_FAILED',
    );
  }
  if (citation.kind === 'WEB' && !citation.url) {
    throw new CitationTrustError(
      'Website citation URL is required',
      'CITATION_VALIDATION_FAILED',
    );
  }
  if (citation.page !== null && (!Number.isInteger(citation.page) || citation.page < 1)) {
    throw new CitationTrustError(
      'Citation page number is invalid',
      'CITATION_VALIDATION_FAILED',
    );
  }
  if (citation.url) {
    try {
      if (new URL(citation.url).protocol !== 'https:') {
        throw new CitationTrustError(
          'Citation URL must use HTTPS',
          'CITATION_VALIDATION_FAILED',
        );
      }
    } catch {
      throw new CitationTrustError(
        'Citation URL is invalid',
        'CITATION_VALIDATION_FAILED',
      );
    }
  }
}

async function validateCitationsForWorkspace(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  citations: CitationInput[],
): Promise<void> {
  citations.forEach(validateCitationInput);
  const uniqueChunkIds = [...new Set(citations.map((citation) => citation.chunkId))];
  if (uniqueChunkIds.length !== citations.length) {
    throw new CitationTrustError(
      'Duplicate citation chunks are not allowed',
      'CITATION_VALIDATION_FAILED',
    );
  }
  if (citations.length === 0) return;

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
    WHERE chunk."workspaceId" = ${workspaceId}
      AND chunk.id IN (${Prisma.join(uniqueChunkIds)})
      AND chunk."sourceVersion" = source_index."sourceVersion"
    FOR SHARE OF chunk, source, source_index
  `;
  const eligibleById = new Map(eligibleChunks.map((chunk) => [chunk.chunkId, chunk]));
  for (const citation of citations) {
    const eligible = eligibleById.get(citation.chunkId);
    if (!eligible) {
      throw new CitationTrustError(
        'Citation references an inactive, missing, stale, or cross-Workspace chunk',
        'CITATION_PROVENANCE_MISMATCH',
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
      throw new CitationTrustError(
        'Citation provenance does not match its indexed chunk',
        'CITATION_PROVENANCE_MISMATCH',
      );
    }
  }
}

export async function createWorkspaceMessage(data: {
  workspaceId: string;
  parentMessageId?: string;
  role: StoredMessage['role'];
  content: string;
  mode?: StoredMessage['mode'];
  responseMode?: ChatResponseMode;
  status?: StoredMessage['status'];
  action?: AIActionRequest;
  resourceRecommendations?: LearningResourceRecommendation[];
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
      if (data.responseMode === 'GENERAL' && citations.length > 0) {
        throw new CitationTrustError(
          'General responses cannot persist Workspace citations',
          'CITATION_VALIDATION_FAILED',
        );
      }
      await validateCitationsForWorkspace(tx, workspace.id, citations);

      if (data.role === 'ASSISTANT') {
        if (!data.parentMessageId) {
          throw new Error('Assistant message requires an originating user query');
        }
        const parent = await tx.message.findFirst({
          where: {
            id: data.parentMessageId,
            workspaceId: workspace.id,
            role: 'USER',
          },
          select: { id: true },
        });
        if (!parent) {
          throw new Error('Originating user query was not found in this Workspace');
        }
      } else if (data.parentMessageId) {
        throw new Error('Only assistant messages may reference an originating query');
      }

      const created = await tx.message.create({
        data: {
          workspaceId: workspace.id,
          parentMessageId: data.parentMessageId,
          role: data.role,
          content: data.content,
          mode: data.mode || 'CONCISE',
          responseMode: data.role === 'ASSISTANT' ? data.responseMode : undefined,
          status: data.status || 'SUCCESS',
          action:
            data.role === 'USER' && data.action
              ? (data.action as unknown as Prisma.InputJsonValue)
              : undefined,
          resourceRecommendations:
            data.role === 'ASSISTANT' && data.resourceRecommendations
              ? (data.resourceRecommendations as unknown as Prisma.InputJsonValue)
              : undefined,
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
        include: {
          citations: {
            ...historicalCitationInclude,
          },
        },
      });

      return toStoredMessage(created);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}

export class ChatMessageConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatMessageConflictError';
  }
}

export interface RegenerationTurn {
  userMessage: StoredMessage;
  assistantMessage: StoredMessage;
}

export async function reserveAssistantRegeneration(
  workspaceId: string,
  assistantMessageId: string,
): Promise<RegenerationTurn | null> {
  return prisma.$transaction(
    async (tx) => {
      const workspace = await tx.workspace.findFirst({
        where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
        select: { id: true },
      });
      if (!workspace) return null;

      const staleReservationCutoff = new Date(Date.now() - 10 * 60 * 1000);
      const activeRegeneration = await tx.message.findFirst({
        where: {
          workspaceId: workspace.id,
          role: 'ASSISTANT',
          status: 'SENDING',
          regenerationStartedAt: { gte: staleReservationCutoff },
          id: { not: assistantMessageId },
        },
        select: { id: true },
      });
      if (activeRegeneration) {
        throw new ChatMessageConflictError(
          'Another response is already being regenerated in this Workspace.',
        );
      }
      const reserved = await tx.message.updateMany({
        where: {
          id: assistantMessageId,
          workspaceId: workspace.id,
          role: 'ASSISTANT',
          parentMessageId: { not: null },
          OR: [
            { status: 'SUCCESS' },
            {
              status: 'SENDING',
              regenerationStartedAt: { lt: staleReservationCutoff },
            },
          ],
        },
        data: {
          status: 'SENDING',
          regenerationStartedAt: new Date(),
        },
      });
      if (reserved.count === 0) {
        const exists = await tx.message.findFirst({
          where: {
            id: assistantMessageId,
            workspaceId: workspace.id,
            role: 'ASSISTANT',
          },
          select: { id: true },
        });
        if (exists) {
          throw new ChatMessageConflictError(
            'This response is already being regenerated.',
          );
        }
        return null;
      }

      const assistant = await tx.message.findUnique({
        where: { id: assistantMessageId },
        include: {
          citations: {
            ...historicalCitationInclude,
          },
          parentMessage: {
            include: {
              citations: {
                ...historicalCitationInclude,
              },
            },
          },
        },
      });
      if (!assistant?.parentMessage || assistant.parentMessage.role !== 'USER') {
        throw new Error('The originating user query is unavailable');
      }

      return {
        userMessage: toStoredMessage(assistant.parentMessage),
        assistantMessage: toStoredMessage(assistant),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}

export async function releaseAssistantRegeneration(
  workspaceId: string,
  assistantMessageId: string,
): Promise<void> {
  await prisma.message.updateMany({
    where: {
      id: assistantMessageId,
      workspaceId,
      role: 'ASSISTANT',
      status: 'SENDING',
    },
    data: {
      status: 'SUCCESS',
      regenerationStartedAt: null,
    },
  });
}

export async function replaceWorkspaceAssistantMessage(data: {
  workspaceId: string;
  assistantMessageId: string;
  content: string;
  mode: StoredMessage['mode'];
  responseMode?: ChatResponseMode;
  status?: 'SUCCESS' | 'ERROR';
  resourceRecommendations?: LearningResourceRecommendation[];
  citations?: CitationInput[];
}): Promise<StoredMessage> {
  return prisma.$transaction(
    async (tx) => {
      const assistant = await tx.message.findFirst({
        where: {
          id: data.assistantMessageId,
          workspaceId: data.workspaceId,
          role: 'ASSISTANT',
          status: 'SENDING',
          parentMessageId: { not: null },
        },
        select: { id: true },
      });
      if (!assistant) {
        throw new ChatMessageConflictError(
          'The response is no longer available for regeneration.',
        );
      }

      const citations = data.citations || [];
      if (data.responseMode === 'GENERAL' && citations.length > 0) {
        throw new CitationTrustError(
          'General responses cannot persist Workspace citations',
          'CITATION_VALIDATION_FAILED',
        );
      }
      await validateCitationsForWorkspace(tx, data.workspaceId, citations);
      await tx.citation.deleteMany({ where: { messageId: assistant.id } });
      const updated = await tx.message.update({
        where: { id: assistant.id },
        data: {
          content: data.content,
          mode: data.mode,
          responseMode: data.responseMode,
          status: data.status || 'SUCCESS',
          resourceRecommendations: data.resourceRecommendations
            ? (data.resourceRecommendations as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          regenerationStartedAt: null,
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
        include: {
          citations: {
            ...historicalCitationInclude,
          },
        },
      });
      return toStoredMessage(updated);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}

export async function attachWorkspaceMessageResources(data: {
  workspaceId: string;
  assistantMessageId: string;
  resourceRecommendations: LearningResourceRecommendation[];
}): Promise<StoredMessage> {
  return prisma.$transaction(async (tx) => {
    const assistant = await tx.message.findFirst({
      where: {
        id: data.assistantMessageId,
        workspaceId: data.workspaceId,
        role: 'ASSISTANT',
        status: 'SUCCESS',
      },
      select: { id: true },
    });
    if (!assistant) {
      throw new ChatMessageConflictError('The completed response is no longer available.');
    }
    const updated = await tx.message.update({
      where: { id: assistant.id },
      data: {
        resourceRecommendations: data.resourceRecommendations.length > 0
          ? (data.resourceRecommendations as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: { citations: { ...historicalCitationInclude } },
    });
    return toStoredMessage(updated);
  });
}

export async function deleteWorkspaceQueryTurn(
  workspaceId: string,
  userMessageId: string,
): Promise<string[] | null> {
  return prisma.$transaction(
    async (tx) => {
      const workspace = await tx.workspace.findFirst({
        where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
        select: { id: true },
      });
      if (!workspace) return null;

      const userMessage = await tx.message.findFirst({
        where: {
          id: userMessageId,
          workspaceId: workspace.id,
          role: 'USER',
        },
        include: {
          replies: { select: { id: true, status: true } },
        },
      });
      if (!userMessage) return null;
      if (userMessage.replies.some((reply) => reply.status === 'SENDING')) {
        throw new ChatMessageConflictError(
          'Wait for response regeneration to finish before deleting this query.',
        );
      }

      const deletedIds = [
        userMessage.id,
        ...userMessage.replies.map((reply) => reply.id),
      ];
      await tx.message.delete({ where: { id: userMessage.id } });
      return deletedIds;
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
