import { prisma } from '../prisma';
import { logger } from '../logger';
import { generateEmbeddingsBatch, generateDeterministicEmbedding } from '../ingestion/embedder';
import { getWorkspaceSources, SourceRecord } from '../source-store';
import { getWorkspaceChunks, StoredChunkRecord } from '../chunk-store';

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

// Cosine similarity helper for vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Generates query embedding vector
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const [vector] = await generateEmbeddingsBatch([query]);
  return vector || generateDeterministicEmbedding(query, 1536);
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
  const queryVector = await generateQueryEmbedding(query);

  let retrieved: RetrievedChunk[] = [];

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

      const vectorStr = `[${queryVector.join(',')}]`;

      // Perform pgvector cosine distance query
      const rawResults: any[] = await prisma.$queryRaw`
        SELECT 
          c.id,
          c."sourceId",
          c."workspaceId",
          c.content,
          c."tokenCount",
          c."chunkIndex",
          (1 - (c.embedding <=> ${vectorStr}::vector)) AS similarity
        FROM "Chunk" c
        WHERE c."workspaceId" = ${targetWsId}
        ORDER BY c.embedding <=> ${vectorStr}::vector
        LIMIT ${topK * 2}
      `;

      if (Array.isArray(rawResults) && rawResults.length > 0) {
        for (const row of rawResults) {
          const sim = typeof row.similarity === 'number' ? row.similarity : parseFloat(row.similarity || '0');
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
      }
    }
  } catch (err) {
    logger.warn('pgvector search workspace chunks raw query failed, falling back to in-memory search', err);
  }

  // 3. Fallback or additional in-memory vector cosine similarity search
  if (retrieved.length === 0) {
    const allChunks = await getWorkspaceChunks(workspaceId);
    const scored = allChunks.map((chk) => {
      const chkVec = chk.embedding || generateDeterministicEmbedding(chk.content, 1536);
      const sim = cosineSimilarity(queryVector, chkVec);
      const src = sourceMap.get(chk.sourceId);
      return {
        id: chk.id,
        sourceId: chk.sourceId,
        workspaceId: chk.workspaceId,
        content: chk.content,
        tokenCount: chk.tokenCount,
        chunkIndex: chk.chunkIndex,
        similarity: Math.round(sim * 1000) / 1000,
        sourceTitle: src?.title || 'Workspace Document',
        sourceType: src?.type || 'TEXT',
        sourceUrl: src?.url || src?.metadata?.url || null,
        sourceMetadata: src?.metadata || null,
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    retrieved = scored.filter((s) => s.similarity >= threshold).slice(0, topK);
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
