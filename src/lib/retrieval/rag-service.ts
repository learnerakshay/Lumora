import { prisma } from '../prisma';
import { generateEmbeddingsBatch } from '../ingestion/embedder';
import { getWorkspaceSources, SourceRecord } from '../source-store';

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  workspaceId: string;
  content: string;
  tokenCount: number;
  chunkIndex: number;
  similarity: number;
  sourceTitle: string;
  sourceType: string;
  sourceUrl?: string | null;
  sourceMetadata?: Record<string, any> | null;
}

export interface RAGContextResult {
  hasContext: boolean;
  contextPrompt: string;
  chunks: RetrievedChunk[];
  citations: Array<{
    id: string;
    chunkId: string;
    title: string;
    snippet: string;
    kind: 'DOCUMENT' | 'WEB' | 'CALCULATION';
    score: number;
    url?: string | null;
    page?: number | string | null;
  }>;
}

// Generates query embedding vector
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const result = await generateEmbeddingsBatch([query]);
  return result.vectors[0];
}

// Searches workspace chunks using vector semantic similarity with strict isolation
export async function searchWorkspaceChunks(
  workspaceId: string,
  query: string,
  options: { topK?: number; threshold?: number } = {}
): Promise<RetrievedChunk[]> {
  const topK = options.topK || 5;
  const threshold = options.threshold ?? 0.15;

  // 1. Fetch workspace sources to map metadata
  const sources = await getWorkspaceSources(workspaceId);
  const sourceMap = new Map<string, SourceRecord>();
  sources.forEach((s) => sourceMap.set(s.id, s));

  // 2. Generate Query Embedding
  const embeddingBatch = await generateEmbeddingsBatch([query]);
  const queryVector = embeddingBatch.vectors[0];
  const contract = embeddingBatch.contract;

  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
    select: { id: true },
  });
  if (!workspace) {
    throw new Error('Workspace not found during vector search');
  }

  const incompatibleIndexes = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Source" source
    INNER JOIN "SourceIndex" source_index
      ON source_index.id = source."activeIndexId"
      AND source_index.status = 'READY'::"SourceIndexStatus"
    WHERE source."workspaceId" = ${workspace.id}
      AND (
        source_index."embeddingProvider" <> ${contract.provider}
        OR source_index."embeddingModel" <> ${contract.model}
        OR source_index."embeddingVersion" <> ${contract.version}
        OR source_index."vectorDimensions" <> ${contract.dimensions}
      )
  `;
  if (Number(incompatibleIndexes[0]?.count ?? 0) > 0) {
    throw new Error(
      'Active Workspace indexes are incompatible with the configured embedding contract; re-indexing is required',
    );
  }

  const vectorStr = `[${queryVector.join(',')}]`;
  const rawResults: any[] = await prisma.$queryRaw`
    SELECT
      chunk.id,
      chunk."sourceId",
      chunk."workspaceId",
      chunk.content,
      chunk."tokenCount",
      chunk."chunkIndex",
      (1 - (chunk.embedding <=> ${vectorStr}::vector)) AS similarity
    FROM "Chunk" chunk
    INNER JOIN "Source" source
      ON source.id = chunk."sourceId"
      AND source."activeIndexId" = chunk."indexId"
    INNER JOIN "SourceIndex" source_index
      ON source_index.id = chunk."indexId"
      AND source_index.status = 'READY'::"SourceIndexStatus"
    WHERE chunk."workspaceId" = ${workspace.id}
      AND chunk.embedding IS NOT NULL
      AND vector_dims(chunk.embedding) = ${contract.dimensions}
      AND source_index."embeddingProvider" = ${contract.provider}
      AND source_index."embeddingModel" = ${contract.model}
      AND source_index."embeddingVersion" = ${contract.version}
      AND source_index."vectorDimensions" = ${contract.dimensions}
    ORDER BY chunk.embedding <=> ${vectorStr}::vector
    LIMIT ${topK * 2}
  `;

  const retrieved: RetrievedChunk[] = [];
  for (const row of rawResults) {
    const sim =
      typeof row.similarity === 'number'
        ? row.similarity
        : parseFloat(row.similarity || '0');
    if (sim >= threshold) {
      const src = sourceMap.get(row.sourceId);
      retrieved.push({
        id: row.id,
        sourceId: row.sourceId,
        workspaceId: row.workspaceId,
        content: row.content,
        tokenCount: row.tokenCount || 0,
        chunkIndex: row.chunkIndex || 0,
        similarity: Math.round(sim * 1000) / 1000,
        sourceTitle: src?.title || 'Workspace Document',
        sourceType: src?.type || 'TEXT',
        sourceUrl: src?.url || src?.metadata?.url || null,
        sourceMetadata: src?.metadata || null,
      });
    }
  }

  // Deduplicate near-identical content snippets
  const uniqueChunks: RetrievedChunk[] = [];
  const seenTexts = new Set<string>();

  for (const item of retrieved) {
    const snippetKey = item.content.trim().substring(0, 100).toLowerCase();
    if (!seenTexts.has(snippetKey)) {
      seenTexts.add(snippetKey);
      uniqueChunks.push(item);
    }
    if (uniqueChunks.length >= topK) break;
  }

  return uniqueChunks;
}

// Builds system/context prompt and citation objects for RAG generation
export function buildRAGContext(
  retrievedChunks: RetrievedChunk[],
  query: string,
  mode: 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE' = 'DETAILED'
): RAGContextResult {
  const hasContext = retrievedChunks.length > 0;

  if (!hasContext) {
    return {
      hasContext: false,
      contextPrompt: `Target Workspace Knowledge Base contains no relevant indexed documents or matching chunks for this query.\n\nInstruction: Politely inform the user that you couldn't find sufficient information inside their current workspace to answer this question. Encourage them to upload relevant sources (PDFs, Web URLs, YouTube videos, VTT transcripts, or text notes) to build their knowledge base. Do NOT invent facts or hallucinate external knowledge.`,
      chunks: [],
      citations: [],
    };
  }

  const citationItems = retrievedChunks.map((chk, idx) => {
    const kind: 'DOCUMENT' | 'WEB' | 'CALCULATION' =
      chk.sourceType === 'WEBSITE' ? 'WEB' : 'DOCUMENT';

    const page = chk.sourceMetadata?.pages ? `Page ${Math.min(chk.chunkIndex + 1, chk.sourceMetadata.pages)}` : null;

    return {
      id: `cit_${chk.id}_${idx}`,
      chunkId: chk.id,
      title: chk.sourceTitle,
      snippet: chk.content.substring(0, 200).replace(/\n+/g, ' ') + '...',
      kind,
      score: chk.similarity,
      url: chk.sourceUrl || null,
      page,
    };
  });

  const contextBlocks = retrievedChunks
    .map((chk, idx) => {
      const pageInfo = chk.sourceMetadata?.pages
        ? ` | Page ${Math.min(chk.chunkIndex + 1, chk.sourceMetadata.pages)}`
        : '';
      const urlInfo = chk.sourceUrl ? ` | URL: ${chk.sourceUrl}` : '';
      return `[CITATION #${idx + 1}] Source: "${chk.sourceTitle}" (Type: ${chk.sourceType}${pageInfo}${urlInfo})\n${chk.content.trim()}`;
    })
    .join('\n\n---\n\n');

  const modeInstructions = {
    CONCISE: 'Provide a crisp, direct, bulleted summary focusing strictly on core facts.',
    DETAILED: 'Provide a thorough, comprehensive synthesis with clear headings, bullet points, and explanatory depth.',
    CRITICAL: 'Examine the information critically, contrasting claims, analyzing assumptions, and highlighting nuances.',
    CREATIVE: 'Synthesize the knowledge in an engaging, narrative style while maintaining strict factual grounding.',
  }[mode];

  const contextPrompt = `You are Lumora AI Knowledge Operating System, an isolated RAG intelligence assistant.
Your answers MUST be grounded in the provided Workspace Knowledge Base context below.

=== WORKSPACE KNOWLEDGE CONTEXT ===
${contextBlocks}
===================================

USER QUERY: "${query}"

INSTRUCTIONS:
1. Ground your response in the provided workspace context snippets above.
2. Synthesize a structured response formatted in clean Markdown (use headers, bold key phrases, bullet points, code blocks or tables where appropriate).
3. Include inline citations matching the sources used (e.g., "[Source: Document Title]" or "[Citation #1]").
4. Tone & Style: ${modeInstructions}
5. If the provided context lacks sufficient information to completely answer certain aspects of the user question, explicitly mention what is present and what is missing. Never hallucinate unverified details outside the workspace context.`;

  return {
    hasContext: true,
    contextPrompt,
    chunks: retrievedChunks,
    citations: citationItems,
  };
}
