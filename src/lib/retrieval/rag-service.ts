import { prisma } from '../prisma';
import {
  EmbeddingContract,
  generateEmbeddingsBatch,
  validateEmbeddingVector,
} from '../ingestion/embedder';

const DEFAULT_TOP_K = 5;
const DEFAULT_THRESHOLD = 0.15;
const DEFAULT_CONTEXT_TOKEN_BUDGET = 3_500;
const MAX_TOP_K = 20;
const MAX_QUERY_CHARACTERS = 32_000;

type SourceType = 'PDF' | 'WEBSITE' | 'TEXT' | 'YOUTUBE' | 'VTT';

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  workspaceId: string;
  indexId: string;
  sourceVersion: number;
  content: string;
  tokenCount: number;
  chunkIndex: number;
  similarity: number;
  sourceTitle: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  parserMetadata: Record<string, unknown> | null;
  sourceCleanText: string;
}

export interface RAGCitation {
  id: string;
  chunkId: string;
  sourceId: string;
  indexId: string;
  title: string;
  snippet: string;
  kind: 'DOCUMENT' | 'WEB';
  score: number;
  url: string | null;
  page: number | null;
  timestampStartMs: number | null;
  timestampEndMs: number | null;
  textOrigin: string;
}

export interface RAGContextResult {
  hasContext: boolean;
  contextPrompt: string;
  chunks: RetrievedChunk[];
  citations: RAGCitation[];
}

interface RawRetrievalRow {
  incompatibleCount: bigint | number | string;
  corruptCount: bigint | number | string;
  id: string | null;
  sourceId: string | null;
  workspaceId: string | null;
  indexId: string | null;
  activeIndexId: string | null;
  indexStatus: string | null;
  sourceVersion: number | null;
  chunkSourceVersion: number | null;
  content: string | null;
  tokenCount: number | null;
  chunkIndex: number | null;
  similarity: number | string | null;
  sourceTitle: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  parserMetadata: unknown;
  sourceCleanText: string | null;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingVersion: string | null;
  vectorDimensions: number | null;
}

export interface RetrievalOptions {
  topK?: number;
  threshold?: number;
  sourceIds?: string[];
}

interface ContextOptions {
  tokenBudget?: number;
}

type RetrievalDatabase = Pick<typeof prisma, 'workspace' | '$queryRaw'>;

interface RetrievalDependencies {
  database?: RetrievalDatabase;
  embedQuery?: typeof generateEmbeddingsBatch;
}

function normalizePassage(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function passageShingles(content: string): Set<string> {
  const words = normalizePassage(content).split(' ').filter(Boolean);
  const shingles = new Set<string>();
  if (words.length < 5) {
    if (words.length) shingles.add(words.join(' '));
    return shingles;
  }
  for (let index = 0; index <= words.length - 5; index += 1) {
    shingles.add(words.slice(index, index + 5).join(' '));
  }
  return shingles;
}

function passageOverlap(left: string, right: string): number {
  const leftShingles = passageShingles(left);
  const rightShingles = passageShingles(right);
  if (leftShingles.size === 0 || rightShingles.size === 0) return 0;
  let intersection = 0;
  for (const shingle of leftShingles) {
    if (rightShingles.has(shingle)) intersection += 1;
  }
  return intersection / Math.min(leftShingles.size, rightShingles.size);
}

function assertCandidateIntegrity(
  row: RawRetrievalRow,
  workspaceId: string,
  contract: EmbeddingContract,
): asserts row is RawRetrievalRow & {
  id: string;
  sourceId: string;
  workspaceId: string;
  indexId: string;
  activeIndexId: string;
  indexStatus: 'READY';
  sourceVersion: number;
  chunkSourceVersion: number;
  content: string;
  chunkIndex: number;
  sourceTitle: string;
  sourceType: SourceType;
  sourceCleanText: string;
} {
  if (row.workspaceId !== workspaceId) {
    throw new Error('Retrieval isolation failure: candidate belongs to another Workspace');
  }
  if (!row.id || !row.sourceId || !row.indexId || row.activeIndexId !== row.indexId) {
    throw new Error('Retrieval integrity failure: orphan or inactive chunk returned');
  }
  if (row.indexStatus !== 'READY') {
    throw new Error('Retrieval integrity failure: index is not READY');
  }
  if (
    !Number.isInteger(row.sourceVersion) ||
    row.sourceVersion !== row.chunkSourceVersion
  ) {
    throw new Error('Retrieval integrity failure: stale chunk source version');
  }
  if (
    row.embeddingProvider !== contract.provider ||
    row.embeddingModel !== contract.model ||
    row.embeddingVersion !== contract.version ||
    row.vectorDimensions !== contract.dimensions
  ) {
    throw new Error('Retrieval integrity failure: incompatible embedding metadata');
  }
  if (!row.content?.trim() || !row.sourceTitle?.trim()) {
    throw new Error('Retrieval integrity failure: candidate content or source title is missing');
  }
  if (!['PDF', 'WEBSITE', 'TEXT', 'YOUTUBE', 'VTT'].includes(row.sourceType || '')) {
    throw new Error('Retrieval integrity failure: source type is invalid');
  }
  if (!Number.isInteger(row.chunkIndex) || row.chunkIndex! < 0) {
    throw new Error('Retrieval integrity failure: chunk index is invalid');
  }
}

function toRetrievedChunk(
  row: RawRetrievalRow,
  workspaceId: string,
  contract: EmbeddingContract,
): RetrievedChunk | null {
  if (!row.id) return null;
  assertCandidateIntegrity(row, workspaceId, contract);
  const similarity =
    typeof row.similarity === 'number'
      ? row.similarity
      : Number.parseFloat(String(row.similarity));
  if (!Number.isFinite(similarity) || similarity < -1.000001 || similarity > 1.000001) {
    throw new Error('Retrieval integrity failure: similarity score is invalid');
  }

  return {
    id: row.id,
    sourceId: row.sourceId,
    workspaceId: row.workspaceId,
    indexId: row.indexId,
    sourceVersion: row.sourceVersion,
    content: row.content,
    tokenCount:
      Number.isInteger(row.tokenCount) && row.tokenCount! > 0
        ? row.tokenCount!
        : Math.ceil(row.content.length / 4),
    chunkIndex: row.chunkIndex,
    similarity,
    sourceTitle: row.sourceTitle,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    parserMetadata:
      row.parserMetadata && typeof row.parserMetadata === 'object'
        ? (row.parserMetadata as Record<string, unknown>)
        : null,
    sourceCleanText: row.sourceCleanText,
  };
}

export function rankAndDeduplicateChunks(
  candidates: RetrievedChunk[],
  topK: number,
  threshold: number,
): RetrievedChunk[] {
  const ordered = [...candidates]
    .filter((candidate) => candidate.similarity >= threshold)
    .sort(
      (left, right) =>
        right.similarity - left.similarity ||
        left.sourceId.localeCompare(right.sourceId) ||
        left.chunkIndex - right.chunkIndex ||
        left.id.localeCompare(right.id),
    );

  const selected: RetrievedChunk[] = [];
  const exactPassages = new Set<string>();
  for (const candidate of ordered) {
    const normalized = normalizePassage(candidate.content);
    if (exactPassages.has(normalized)) continue;
    const duplicatePassage = selected.some(
      (existing) =>
        existing.sourceId === candidate.sourceId &&
        passageOverlap(existing.content, candidate.content) >= 0.9,
    );
    if (duplicatePassage) continue;
    exactPassages.add(normalized);
    selected.push(candidate);
    if (selected.length >= topK) break;
  }
  return selected;
}

// Generates a query vector using the Prompt 3 document/query embedding contract.
export async function generateQueryEmbedding(query: string): Promise<{
  vector: number[];
  contract: EmbeddingContract;
}> {
  const result = await generateEmbeddingsBatch([query]);
  const vector = result.vectors[0];
  validateEmbeddingVector(vector, result.contract, 'query embedding');
  return { vector, contract: result.contract };
}

export async function searchWorkspaceChunks(
  workspaceId: string,
  userId: string,
  query: string,
  options: RetrievalOptions = {},
  dependencies: RetrievalDependencies = {},
): Promise<RetrievedChunk[]> {
  const database = dependencies.database || prisma;
  const embedQuery = dependencies.embedQuery || generateEmbeddingsBatch;
  const cleanQuery = query.trim();
  if (!workspaceId || !userId) {
    throw new Error('Workspace and authenticated user are required for retrieval');
  }
  if (!cleanQuery || cleanQuery.length > MAX_QUERY_CHARACTERS) {
    throw new Error('Retrieval query is empty or exceeds the supported size');
  }

  const topK = Math.min(Math.max(Math.floor(options.topK || DEFAULT_TOP_K), 1), MAX_TOP_K);
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
    throw new Error('Retrieval similarity threshold must be between -1 and 1');
  }
  const sourceIds = options.sourceIds
    ? [...new Set(options.sourceIds.map((sourceId) => sourceId.trim()).filter(Boolean))]
    : [];
  if (options.sourceIds && sourceIds.length === 0) {
    throw new Error('Source-scoped retrieval requires at least one valid source ID');
  }
  if (sourceIds.length > 50) {
    throw new Error('Source-scoped retrieval cannot exceed 50 sources');
  }

  const workspace = await database.workspace.findFirst({
    where: {
      userId,
      OR: [{ id: workspaceId }, { slug: workspaceId }],
    },
    select: { id: true },
  });
  if (!workspace) {
    throw new Error('Workspace retrieval access denied');
  }

  const embeddingBatch = await embedQuery([cleanQuery]);
  const queryVector = embeddingBatch.vectors[0];
  const contract = embeddingBatch.contract;
  validateEmbeddingVector(queryVector, contract, 'query embedding');

  const vectorLiteral = `[${queryVector.join(',')}]`;
  const candidateLimit = Math.max(topK * 4, 20);
  const rows = await database.$queryRaw<RawRetrievalRow[]>`
    WITH active_indexes AS (
      SELECT
        source.id AS "sourceId",
        source."workspaceId",
        source.title AS "sourceTitle",
        source.type::text AS "sourceType",
        source."activeIndexId",
        source_index.id AS "indexId",
        source_index.status::text AS "indexStatus",
        source_index."sourceVersion",
        source_index."expectedChunkCount",
        source_index."embeddingProvider",
        source_index."embeddingModel",
        source_index."embeddingVersion",
        source_index."vectorDimensions",
        source_content.version AS "contentVersion",
        source_content."sourceUrl",
        source_content."parserMetadata",
        source_content."cleanText" AS "sourceCleanText",
        (
          SELECT COUNT(*)::integer
          FROM "Chunk" counted_chunk
          WHERE counted_chunk."indexId" = source_index.id
        ) AS "actualChunkCount",
        (
          SELECT COUNT(*)::integer
          FROM "Chunk" valid_chunk
          WHERE valid_chunk."indexId" = source_index.id
            AND valid_chunk.embedding IS NOT NULL
            AND vector_dims(valid_chunk.embedding) = source_index."vectorDimensions"
            AND valid_chunk."sourceVersion" = source_index."sourceVersion"
            AND valid_chunk."sourceId" = source.id
            AND valid_chunk."workspaceId" = source."workspaceId"
        ) AS "validChunkCount"
      FROM "Source" source
      INNER JOIN "SourceIndex" source_index
        ON source_index.id = source."activeIndexId"
        AND source_index.status = 'READY'::"SourceIndexStatus"
      LEFT JOIN "SourceContent" source_content
        ON source_content."sourceId" = source.id
        AND source_content.version = source_index."sourceVersion"
      WHERE source."workspaceId" = ${workspace.id}
        AND (${sourceIds.length === 0} OR source.id = ANY(${sourceIds}::text[]))
    ),
    index_state AS (
      SELECT
        (
          COUNT(*) FILTER (
            WHERE "embeddingProvider" <> ${contract.provider}
              OR "embeddingModel" <> ${contract.model}
              OR "embeddingVersion" <> ${contract.version}
              OR "vectorDimensions" <> ${contract.dimensions}
          )
        )::bigint AS "incompatibleCount",
        (
          COUNT(*) FILTER (
            WHERE "contentVersion" IS NULL
              OR "actualChunkCount" <> "expectedChunkCount"
              OR "validChunkCount" <> "expectedChunkCount"
          )
        )::bigint AS "corruptCount"
      FROM active_indexes
    ),
    candidates AS (
      SELECT
        chunk.id,
        active_index."sourceId",
        chunk."workspaceId",
        active_index."indexId",
        active_index."activeIndexId",
        active_index."indexStatus",
        active_index."sourceVersion",
        chunk."sourceVersion" AS "chunkSourceVersion",
        chunk.content,
        chunk."tokenCount",
        chunk."chunkIndex",
        (1 - (chunk.embedding <=> ${vectorLiteral}::vector)) AS similarity,
        active_index."sourceTitle",
        active_index."sourceType",
        active_index."sourceUrl",
        active_index."parserMetadata",
        active_index."sourceCleanText",
        active_index."embeddingProvider",
        active_index."embeddingModel",
        active_index."embeddingVersion",
        active_index."vectorDimensions"
      FROM "Chunk" chunk
      INNER JOIN active_indexes active_index
        ON active_index."indexId" = chunk."indexId"
        AND active_index."sourceId" = chunk."sourceId"
      WHERE chunk."workspaceId" = ${workspace.id}
        AND chunk."sourceVersion" = active_index."sourceVersion"
        AND chunk.embedding IS NOT NULL
        AND vector_dims(chunk.embedding) = ${contract.dimensions}
        AND active_index."actualChunkCount" = active_index."expectedChunkCount"
        AND active_index."validChunkCount" = active_index."expectedChunkCount"
        AND active_index."contentVersion" IS NOT NULL
        AND active_index."embeddingProvider" = ${contract.provider}
        AND active_index."embeddingModel" = ${contract.model}
        AND active_index."embeddingVersion" = ${contract.version}
        AND active_index."vectorDimensions" = ${contract.dimensions}
      ORDER BY
        chunk.embedding <=> ${vectorLiteral}::vector,
        chunk."sourceId",
        chunk."chunkIndex",
        chunk.id
      LIMIT ${candidateLimit}
    )
    SELECT
      index_state."incompatibleCount",
      index_state."corruptCount",
      candidates.*
    FROM index_state
    LEFT JOIN candidates ON TRUE
    ORDER BY
      candidates.similarity DESC NULLS LAST,
      candidates."sourceId",
      candidates."chunkIndex",
      candidates.id
  `;

  const incompatibleCount = Number(rows[0]?.incompatibleCount ?? 0);
  const corruptCount = Number(rows[0]?.corruptCount ?? 0);
  if (incompatibleCount > 0) {
    throw new Error(
      'Active Workspace indexes are incompatible with the configured embedding contract; re-indexing is required',
    );
  }
  if (corruptCount > 0) {
    throw new Error('Active Workspace index integrity validation failed; re-indexing is required');
  }

  const candidates = rows
    .map((row) => toRetrievedChunk(row, workspace.id, contract))
    .filter((chunk): chunk is RetrievedChunk => Boolean(chunk));
  return rankAndDeduplicateChunks(candidates, topK, threshold);
}

function parseClockTimestamp(value: string): number | null {
  const parts = value.split(':').map(Number);
  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isFinite(part)) ||
    parts[0] < 0 ||
    parts[1] < 0 ||
    parts[1] >= 60 ||
    parts[2] < 0 ||
    parts[2] >= 60
  ) {
    return null;
  }
  return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
}

function formatTimestamp(milliseconds: number): string {
  const totalSeconds = milliseconds / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function findPdfPage(chunk: RetrievedChunk): number | null {
  const pages = Array.isArray(chunk.parserMetadata?.pages)
    ? chunk.parserMetadata.pages
    : [];
  const pageMarker = chunk.content.match(/\[Page\s+(\d+)\]/i);
  if (pageMarker) {
    const pageNumber = Number(pageMarker[1]);
    if (
      pages.some(
        (page) =>
          page &&
          typeof page === 'object' &&
          Number((page as Record<string, unknown>).pageNumber) === pageNumber,
      )
    ) {
      return pageNumber;
    }
  }

  const sourceOffset = chunk.sourceCleanText.indexOf(chunk.content);
  if (sourceOffset >= 0) {
    const matchingPage = pages.find((page) => {
      if (!page || typeof page !== 'object') return false;
      const candidate = page as Record<string, unknown>;
      return (
        Number.isInteger(candidate.characterStart) &&
        Number.isInteger(candidate.characterEnd) &&
        sourceOffset >= Number(candidate.characterStart) &&
        sourceOffset <= Number(candidate.characterEnd)
      );
    }) as Record<string, unknown> | undefined;
    if (matchingPage && Number.isInteger(matchingPage.pageNumber)) {
      return Number(matchingPage.pageNumber);
    }
  }

  const normalizedChunk = normalizePassage(chunk.content.replace(/\[Page\s+\d+\]/gi, ''));
  for (const page of pages) {
    if (!page || typeof page !== 'object') continue;
    const candidate = page as Record<string, unknown>;
    if (typeof candidate.text !== 'string' || !Number.isInteger(candidate.pageNumber)) continue;
    const normalizedPage = normalizePassage(candidate.text);
    const probe = normalizedChunk.slice(0, Math.min(120, normalizedChunk.length));
    if (probe.length >= 30 && normalizedPage.includes(probe)) {
      return Number(candidate.pageNumber);
    }
  }
  return null;
}

function findTranscriptRange(chunk: RetrievedChunk): {
  startMs: number | null;
  endMs: number | null;
} {
  const timestampPattern =
    /\[(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s*(?:-->|-)\s*(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\]/g;
  const ranges: Array<{ startMs: number; endMs: number }> = [];
  for (const match of chunk.content.matchAll(timestampPattern)) {
    const startMs = parseClockTimestamp(match[1]);
    const endMs = parseClockTimestamp(match[2]);
    if (startMs !== null && endMs !== null && endMs >= startMs) {
      ranges.push({ startMs, endMs });
    }
  }
  if (ranges.length) {
    return {
      startMs: Math.min(...ranges.map((range) => range.startMs)),
      endMs: Math.max(...ranges.map((range) => range.endMs)),
    };
  }

  const cues = Array.isArray(chunk.parserMetadata?.cues)
    ? chunk.parserMetadata.cues
    : [];
  const normalizedChunk = normalizePassage(chunk.content);
  for (const cue of cues) {
    if (!cue || typeof cue !== 'object') continue;
    const candidate = cue as Record<string, unknown>;
    if (
      typeof candidate.text !== 'string' ||
      !normalizedChunk.includes(normalizePassage(candidate.text))
    ) {
      continue;
    }
    const startMs =
      Number.isFinite(candidate.offset)
        ? Number(candidate.offset)
        : Number.isFinite(candidate.startMs)
          ? Number(candidate.startMs)
          : null;
    const endMs =
      Number.isFinite(candidate.duration) && startMs !== null
        ? startMs + Number(candidate.duration)
        : Number.isFinite(candidate.endMs)
          ? Number(candidate.endMs)
          : null;
    if (startMs !== null && endMs !== null && endMs >= startMs) {
      return { startMs, endMs };
    }
  }
  return { startMs: null, endMs: null };
}

function validSourceUrl(sourceType: SourceType, sourceUrl: string | null): string | null {
  if (!sourceUrl) {
    if (sourceType === 'WEBSITE') {
      throw new Error('Website citation metadata is missing its source URL');
    }
    return null;
  }
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== 'https:') {
      throw new Error('Citation source URL is not HTTPS');
    }
    return parsed.toString();
  } catch {
    throw new Error('Citation source URL is invalid');
  }
}

export function createCitation(chunk: RetrievedChunk): RAGCitation {
  const url = validSourceUrl(chunk.sourceType, chunk.sourceUrl);
  const page = chunk.sourceType === 'PDF' ? findPdfPage(chunk) : null;
  const transcriptRange =
    chunk.sourceType === 'YOUTUBE' || chunk.sourceType === 'VTT'
      ? findTranscriptRange(chunk)
      : { startMs: null, endMs: null };
  if (chunk.sourceType === 'PDF' && page === null) {
    throw new Error('PDF citation page could not be derived from parser metadata');
  }
  if (
    (chunk.sourceType === 'YOUTUBE' || chunk.sourceType === 'VTT') &&
    (transcriptRange.startMs === null || transcriptRange.endMs === null)
  ) {
    throw new Error(`${chunk.sourceType} citation timestamp could not be derived`);
  }

  let textOrigin: string;
  if (chunk.sourceType === 'PDF') {
    textOrigin = page ? `PDF page ${page}` : 'PDF extracted text';
  } else if (chunk.sourceType === 'WEBSITE') {
    textOrigin = `Website ${url}`;
  } else if (chunk.sourceType === 'YOUTUBE') {
    textOrigin =
      transcriptRange.startMs !== null && transcriptRange.endMs !== null
        ? `YouTube transcript ${formatTimestamp(transcriptRange.startMs)}–${formatTimestamp(
            transcriptRange.endMs,
          )}`
        : 'YouTube transcript';
  } else if (chunk.sourceType === 'VTT') {
    textOrigin =
      transcriptRange.startMs !== null && transcriptRange.endMs !== null
        ? `VTT transcript ${formatTimestamp(transcriptRange.startMs)}–${formatTimestamp(
            transcriptRange.endMs,
          )}`
        : 'VTT transcript';
  } else {
    textOrigin = 'Plain text source';
  }

  const normalizedSnippet = chunk.content.replace(/\s+/g, ' ').trim();
  const snippet =
    normalizedSnippet.length > 300
      ? `${normalizedSnippet.slice(0, 300).trimEnd()}…`
      : normalizedSnippet;
  return {
    id: `citation:${chunk.indexId}:${chunk.id}`,
    chunkId: chunk.id,
    sourceId: chunk.sourceId,
    indexId: chunk.indexId,
    title: chunk.sourceTitle,
    snippet,
    kind: chunk.sourceType === 'WEBSITE' ? 'WEB' : 'DOCUMENT',
    score: chunk.similarity,
    url,
    page,
    timestampStartMs: transcriptRange.startMs,
    timestampEndMs: transcriptRange.endMs,
    textOrigin,
  };
}

function citationLocation(citation: RAGCitation): string {
  const details = [citation.textOrigin];
  if (citation.url) details.push(`URL: ${citation.url}`);
  return details.join(' | ');
}

// Builds context using complete chunks only. The query is supplied once as the
// final provider input rather than duplicated inside these system instructions.
export function buildRAGContext(
  retrievedChunks: RetrievedChunk[],
  _query: string,
  _mode: 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE' = 'CONCISE',
  options: ContextOptions = {},
): RAGContextResult {
  const tokenBudget = Math.max(Math.floor(options.tokenBudget || DEFAULT_CONTEXT_TOKEN_BUDGET), 1);
  const selectedChunks: RetrievedChunk[] = [];
  let consumedTokens = 0;
  for (const chunk of retrievedChunks) {
    const requiredTokens = Math.max(chunk.tokenCount, Math.ceil(chunk.content.length / 4)) + 40;
    if (consumedTokens + requiredTokens > tokenBudget) continue;
    selectedChunks.push(chunk);
    consumedTokens += requiredTokens;
  }

  const hasContext = selectedChunks.length > 0;
  if (!hasContext) {
    return {
      hasContext: false,
      contextPrompt: `Target Workspace Knowledge Base contains no relevant indexed documents or matching chunks for this query.\n\nInstruction: Politely inform the user that you couldn't find sufficient information inside their current workspace to answer this question. Encourage them to upload relevant sources (PDFs, Web URLs, YouTube videos, VTT transcripts, or text notes) to build their knowledge base. Do NOT invent facts or hallucinate external knowledge.`,
      chunks: [],
      citations: [],
    };
  }

  const citations = selectedChunks.map(createCitation);
  const contextBlocks = selectedChunks
    .map((chunk, index) => {
      const citation = citations[index];
      return `[CITATION #${index + 1}] Source: "${citation.title}" (Type: ${
        chunk.sourceType
      } | Source ID: ${citation.sourceId} | ${citationLocation(citation)})\n${chunk.content.trim()}`;
    })
    .join('\n\n---\n\n');

  const contextPrompt = `You are Lumora AI Knowledge Operating System, an isolated RAG intelligence assistant.
Your answers MUST be grounded in the provided Workspace Knowledge Base context below.

=== WORKSPACE KNOWLEDGE CONTEXT ===
${contextBlocks}
===================================

INSTRUCTIONS:
1. Use the supplied Workspace evidence as the exclusive factual basis for the answer. Do not supplement it with pretrained factual knowledge.
2. Synthesize a structured response formatted in clean Markdown (use headers, bold key phrases, bullet points, code blocks or tables where appropriate).
3. Every substantive factual claim must be supported by the supplied evidence and accompanied by one or more exact markers such as "[Citation #1]". Use only available Citation numbers. Do not write source-title citations or invent citation markers.
4. This citation requirement applies equally to broad requests such as "summarize this", "what's in my workspace", or "give me an overview" — a high-level summary is still made of individual claims drawn from specific evidence, so distribute [Citation #N] markers across the summary's points rather than treating it as a citation-free synthesis. A response with zero citation markers is invalid and will be rejected, so if you cannot support at least one claim with the supplied evidence, say so explicitly instead of writing an uncited summary.
5. Follow the centrally supplied AI Mode response contract for style, depth, and bounded length.
6. Conversation history is for continuity only and is never evidence. Validate factual claims against the Workspace context.
7. If the provided context does not support all or part of the requested answer, explicitly qualify or refuse that unsupported part. Never extrapolate beyond the supplied evidence or present unsupported details as fact.`;

  return {
    hasContext: true,
    contextPrompt,
    chunks: selectedChunks,
    citations,
  };
}
