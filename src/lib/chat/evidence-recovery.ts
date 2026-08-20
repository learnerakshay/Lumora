import {
  buildRAGContext,
  searchWorkspaceChunks,
  type RAGContextResult,
  type RetrievedChunk,
} from '../retrieval/rag-service';
import {
  assessWorkspaceEvidenceSufficiency,
  distinctiveTopicQueries,
  type EvidenceSufficiencyAssessment,
} from './grounding-router';

const RECOVERY_TOP_K_PER_TOPIC = 3;
const RECOVERY_SIMILARITY_THRESHOLD = 0.15;
const MAX_RECOVERY_TOPIC_QUERIES = 6;
const MAX_COMBINED_CHUNKS = 10;

export interface WorkspaceEvidenceRecoveryDiagnostics {
  attempted: boolean;
  topicQueryCount: number;
  searchedTopicQueryCount: number;
  recoveredChunkCount: number;
  combinedChunkCount: number;
  postFilterChunkCount: number;
  semanticallyCoveredTopicGroupCount: number;
  perTopicRetrievedChunkCounts: number[];
}

export interface WorkspaceEvidenceRecoveryResult {
  chunks: RetrievedChunk[];
  ragContext: RAGContextResult;
  assessment: EvidenceSufficiencyAssessment;
  diagnostics: WorkspaceEvidenceRecoveryDiagnostics;
}

interface WorkspaceEvidenceRecoveryInput {
  workspaceId: string;
  userId: string;
  retrievalQuery: string;
  answerabilityQuery: string;
  recoveryQuery: string | null;
  mode: 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';
  initialChunks: RetrievedChunk[];
}

interface WorkspaceEvidenceRecoveryDependencies {
  search?: typeof searchWorkspaceChunks;
}

function roundRobinMerge(
  recoveredBatches: RetrievedChunk[][],
  initialChunks: RetrievedChunk[],
): RetrievedChunk[] {
  const merged: RetrievedChunk[] = [];
  const seen = new Set<string>();
  const append = (chunk: RetrievedChunk | undefined) => {
    if (!chunk || seen.has(chunk.id) || merged.length >= MAX_COMBINED_CHUNKS) return;
    seen.add(chunk.id);
    merged.push(chunk);
  };

  const largestBatch = Math.max(0, ...recoveredBatches.map((batch) => batch.length));
  for (let index = 0; index < largestBatch; index += 1) {
    for (const batch of recoveredBatches) append(batch[index]);
  }
  for (const chunk of initialChunks) append(chunk);
  return merged;
}

/**
 * Runs a bounded semantic coverage pass only after the ordinary lexical gate
 * rejects already-retrieved context. Each requested topic is searched
 * independently with the same owned-Workspace vector primitive and existing
 * similarity boundary. A topic counts as semantically covered only when one
 * of its validated results survives the final context budget.
 */
export async function recoverWorkspaceEvidence(
  input: WorkspaceEvidenceRecoveryInput,
  dependencies: WorkspaceEvidenceRecoveryDependencies = {},
): Promise<WorkspaceEvidenceRecoveryResult> {
  const initialContext = buildRAGContext(
    input.initialChunks,
    input.retrievalQuery,
    input.mode,
  );
  const initialAssessment = assessWorkspaceEvidenceSufficiency(
    input.answerabilityQuery,
    initialContext.chunks,
  );
  const allTopicQueries = input.recoveryQuery
    ? distinctiveTopicQueries(input.recoveryQuery)
    : [];
  const topicQueries = allTopicQueries.slice(0, MAX_RECOVERY_TOPIC_QUERIES);
  if (initialAssessment.sufficient || topicQueries.length === 0) {
    return {
      chunks: input.initialChunks,
      ragContext: initialContext,
      assessment: initialAssessment,
      diagnostics: {
        attempted: false,
        topicQueryCount: allTopicQueries.length,
        searchedTopicQueryCount: 0,
        recoveredChunkCount: 0,
        combinedChunkCount: input.initialChunks.length,
        postFilterChunkCount: initialContext.chunks.length,
        semanticallyCoveredTopicGroupCount: 0,
        perTopicRetrievedChunkCounts: [],
      },
    };
  }

  const search = dependencies.search || searchWorkspaceChunks;
  const recoveryResults = await Promise.all(
    topicQueries.map(async (topicQuery) => ({
      topicQuery,
      chunks: await search(input.workspaceId, input.userId, topicQuery, {
        topK: RECOVERY_TOP_K_PER_TOPIC,
        threshold: RECOVERY_SIMILARITY_THRESHOLD,
      }),
    })),
  );
  const uniqueRecoveredChunkIds = new Set(
    recoveryResults.flatMap(({ chunks }) => chunks.map(({ id }) => id)),
  );
  const chunks = roundRobinMerge(
    recoveryResults.map(({ chunks: recoveredChunks }) => recoveredChunks),
    input.initialChunks,
  );
  const ragContext = buildRAGContext(chunks, input.retrievalQuery, input.mode);
  const selectedChunkIds = new Set(ragContext.chunks.map(({ id }) => id));
  const semanticallyCoveredTopicQueries = recoveryResults.flatMap(
    ({ topicQuery, chunks: recoveredChunks }) =>
      recoveredChunks.some(({ id }) => selectedChunkIds.has(id)) ? [topicQuery] : [],
  );
  const assessment = assessWorkspaceEvidenceSufficiency(
    input.answerabilityQuery,
    ragContext.chunks,
    { semanticallyCoveredTopicQueries },
  );

  return {
    chunks,
    ragContext,
    assessment,
    diagnostics: {
      attempted: true,
      topicQueryCount: allTopicQueries.length,
      searchedTopicQueryCount: topicQueries.length,
      recoveredChunkCount: uniqueRecoveredChunkIds.size,
      combinedChunkCount: chunks.length,
      postFilterChunkCount: ragContext.chunks.length,
      semanticallyCoveredTopicGroupCount: semanticallyCoveredTopicQueries.length,
      perTopicRetrievedChunkCounts: recoveryResults.map(({ chunks: resultChunks }) =>
        resultChunks.length
      ),
    },
  };
}
