import {
  claimProcessingAttempt,
  getSourceArtifact,
  persistParsedSourceArtifact,
  ProcessingStage,
  SourceType,
  touchProcessingAttempt,
  transitionProcessingStage,
} from '../source-store';
import { parseSourceContent } from './parsers';
import { generateSemanticChunks } from './chunker';
import { generateEmbeddingsBatch } from './embedder';
import { saveSourceIndex } from '../chunk-store';
import { logger } from '../logger';
import { classifyIngestionError } from './errors';

const CHUNK_VERSION = 'semantic-1200-200-v1';
export const YOUTUBE_HEARTBEAT_INTERVAL_MS = 30_000;

export interface IngestionOptions {
  sourceId: string;
  workspaceId: string;
  title: string;
  type: SourceType;
  version?: number;
  usageEventId?: string;
  // Set by IngestionCoordinator.dispatch() the instant it is invoked (i.e.
  // right after the HTTP request persists the source row). There is no
  // separate job queue/worker process in this architecture — dispatch runs
  // the pipeline in-process — so this measures dispatch-to-claim scheduling
  // latency (event loop + the claimProcessingAttempt transaction), not queue
  // wait in a traditional worker-pool sense.
  dispatchedAt?: number;
}

function requiresRemoteFetch(
  type: SourceType,
  artifact: Awaited<ReturnType<typeof getSourceArtifact>>,
): boolean {
  if (!artifact) return false;
  if (type === 'PDF') return !artifact.artifactData && Boolean(artifact.sourceUrl);
  if (type === 'WEBSITE') {
    return !artifact.originalContent || !/<html|<!doctype|<body/i.test(artifact.originalContent);
  }
  if (type === 'YOUTUBE') {
    return !artifact.originalContent?.startsWith('{"kind":"youtube-transcript-v1"');
  }
  if (type === 'VTT') return !artifact.originalContent && Boolean(artifact.sourceUrl);
  return false;
}

export async function runWithPeriodicHeartbeat<T>(
  operation: () => Promise<T>,
  heartbeat: () => Promise<void>,
  intervalMs = YOUTUBE_HEARTBEAT_INTERVAL_MS,
): Promise<T> {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatError: unknown = null;

  const schedule = () => {
    timer = setTimeout(async () => {
      try {
        await heartbeat();
      } catch (error) {
        heartbeatError = error;
      }
      if (!stopped && !heartbeatError) schedule();
    }, intervalMs);
  };

  schedule();
  try {
    const result = await operation();
    if (heartbeatError) throw heartbeatError;
    return result;
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
  }
}

export async function processSourcePipeline(options: IngestionOptions): Promise<{
  success: boolean;
  chunkCount: number;
  tokenCount: number;
  claimed: boolean;
  error?: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
}> {
  const artifact = await getSourceArtifact(options.sourceId, options.version);
  if (!artifact) {
    throw new Error(`Persisted artifact not found for source ${options.sourceId}`);
  }
  const version = artifact.version;
  const processingAttemptId = await claimProcessingAttempt({
    sourceId: options.sourceId,
    version,
  });
  if (!processingAttemptId) {
    logger.info('Ingestion claim skipped because the attempt is already claimed or obsolete', {
      sourceId: options.sourceId,
      version,
      sourceType: options.type,
    });
    return {
      success: false,
      claimed: false,
      chunkCount: 0,
      tokenCount: 0,
      error: 'Processing attempt was already claimed.',
    };
  }

  const pipelineStartedAt = Date.now();
  const queueWaitMs = options.dispatchedAt !== undefined
    ? Math.max(0, pipelineStartedAt - options.dispatchedAt)
    : null;
  let currentStage: ProcessingStage = 'QUEUED';
  let stageStartedAt = Date.now();
  const stageDurationsMs: Partial<Record<ProcessingStage, number>> = {};

  const enterStage = async (
    nextStage: ProcessingStage,
    details: Record<string, any> = {},
  ): Promise<void> => {
    const previousStage = currentStage;
    const previousStageDurationMs = Date.now() - stageStartedAt;
    stageDurationsMs[previousStage] = previousStageDurationMs;
    logger.info('Ingestion stage completed', {
      sourceId: options.sourceId,
      version,
      processingAttemptId,
      sourceType: options.type,
      stage: previousStage,
      durationMs: previousStageDurationMs,
      nextStage,
    });
    await transitionProcessingStage({
      sourceId: options.sourceId,
      version,
      nextStage,
      details: {
        ...details,
        previousStage,
        previousStageDurationMs,
      },
    });
    currentStage = nextStage;
    stageStartedAt = Date.now();
  };

  const heartbeat = async (): Promise<void> => {
    const touched = await touchProcessingAttempt({
      sourceId: options.sourceId,
      version,
      stage: currentStage,
    });
    if (!touched) {
      throw new Error('Processing attempt lease was lost');
    }
  };

  logger.info('Starting claimed ingestion attempt', {
    sourceId: options.sourceId,
    version,
    processingAttemptId,
    attemptNumber: version,
    sourceType: options.type,
  });

  try {
    await enterStage('PROCESSING');

    const needsFetch = requiresRemoteFetch(options.type, artifact);
    let parsingTransitionCompleted = false;
    if (needsFetch) {
      await enterStage('FETCHING');
    } else {
      await enterStage('PARSING');
      parsingTransitionCompleted = true;
    }

    const parse = () => parseSourceContent({
      type: options.type,
      title: options.title,
      sourceUrl: artifact.sourceUrl,
      originalContent: artifact.originalContent,
      artifactData: artifact.artifactData,
      artifactFileName: artifact.artifactFileName,
      artifactMimeType: artifact.artifactMimeType,
      parserMetadata: artifact.parserMetadata,
      onParsing: async () => {
        if (!parsingTransitionCompleted) {
          await enterStage('PARSING');
          parsingTransitionCompleted = true;
        }
      },
      onHeartbeat: heartbeat,
    });
    const parsed = options.type === 'YOUTUBE'
      ? await runWithPeriodicHeartbeat(parse, heartbeat)
      : await parse();

    if (!parsingTransitionCompleted) {
      throw new Error('Parser did not enter the PARSING stage');
    }
    if (!parsed.cleanText.trim() || !parsed.rawText.trim()) {
      throw new Error(`${options.type} parser produced empty content`);
    }

    await persistParsedSourceArtifact({
      sourceId: options.sourceId,
      version,
      originalContent: parsed.originalContent,
      artifactData: parsed.artifactData,
      artifactFileName: parsed.artifactFileName,
      artifactMimeType: parsed.artifactMimeType,
      artifactSize: parsed.artifactSize,
      sourceUrl: parsed.sourceUrl,
      rawContent: parsed.rawText,
      cleanText: parsed.cleanText,
      parserMetadata: parsed.metadata,
      parserVersion: parsed.parserVersion,
    });

    await enterStage('CHUNKING', {
      parserVersion: parsed.parserVersion,
      textLength: parsed.cleanText.length,
      remoteSource: Boolean(parsed.sourceUrl),
      artifactSize: parsed.artifactSize ?? null,
    });

    const chunks = generateSemanticChunks(parsed.cleanText, {
      targetChunkSize: 1200,
      overlapSize: 200,
    });
    if (chunks.length === 0) {
      throw new Error('Chunking produced zero valid content segments');
    }

    await enterStage('READY_FOR_INDEXING', { chunkCount: chunks.length });
    await enterStage('EMBEDDING', { chunkCount: chunks.length });

    const embeddingBatch = await generateEmbeddingsBatch(
      chunks.map((chunk) => chunk.content),
      async (_processed, _total, progress) => {
        await heartbeat();
        if (progress) {
          logger.info('Ingestion embedding batch completed', {
            sourceId: options.sourceId,
            version,
            sourceType: options.type,
            stage: currentStage,
            processed: progress.processed,
            total: progress.total,
            batchIndex: progress.batchIndex,
            batchCount: progress.batchCount,
            attempts: progress.attempts,
            durationMs: progress.durationMs,
          });
        }
      },
    );
    if (embeddingBatch.vectors.length !== chunks.length) {
      throw new Error('Embedding generation did not return one vector per chunk');
    }

    await enterStage('INDEXING', {
      chunkCount: chunks.length,
      embeddingProvider: embeddingBatch.contract.provider,
      embeddingModel: embeddingBatch.contract.model,
      embeddingVersion: embeddingBatch.contract.version,
      vectorDimensions: embeddingBatch.contract.dimensions,
      chunkVersion: CHUNK_VERSION,
    });
    const tokenCount = chunks.reduce(
      (total, chunk) => total + chunk.tokenEstimate,
      0,
    );
    const youtubeAcquisitionProvider = options.type === 'YOUTUBE'
      ? parsed.metadata.transcriptProvider || 'gemini'
      : null;
    const ingestionProvider = options.type === 'YOUTUBE'
      ? `${youtubeAcquisitionProvider}+openai`
      : 'openai';
    const ingestionModel = options.type === 'YOUTUBE'
      ? `${youtubeAcquisitionProvider === 'gemini' ? 'gemini-3.6-flash' : youtubeAcquisitionProvider} + ${embeddingBatch.contract.model}`
      : embeddingBatch.contract.model;
    const committedIndex = await saveSourceIndex({
      workspaceId: options.workspaceId,
      sourceId: options.sourceId,
      sourceVersion: version,
      chunkVersion: CHUNK_VERSION,
      contract: embeddingBatch.contract,
      chunks: chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddingBatch.vectors[index],
      })),
      completion: {
        pipelineStartedAt,
        details: {
          tokenCount,
          processingAttemptId,
          attemptNumber: version,
          provider: ingestionProvider,
          model: ingestionModel,
          ...(embeddingBatch.inputTokens !== undefined
            ? { inputTokens: embeddingBatch.inputTokens }
            : {}),
          textLength: parsed.cleanText.length,
          parserVersion: parsed.parserVersion,
          ...(options.type === 'YOUTUBE'
            ? {
                videoId: parsed.metadata.videoId,
                transcriptProvider: parsed.metadata.transcriptProvider,
                transcriptStrategy: parsed.metadata.transcriptStrategy,
                acquisitionDurationMs: parsed.metadata.acquisitionDurationMs,
                segmentCount: parsed.metadata.cueCount,
                extractionTextLength: parsed.metadata.extractionTextLength,
                timestampSpanMs: parsed.metadata.timestampSpanMs,
                charactersPerMinute: parsed.metadata.charactersPerMinute,
                extractionQuality: parsed.metadata.extractionQuality,
              }
            : {}),
        },
      },
    });
    const indexingDurationMs = Date.now() - stageStartedAt;
    stageDurationsMs.INDEXING = indexingDurationMs;
    logger.info('Ingestion stage completed', {
      sourceId: options.sourceId,
      version,
      sourceType: options.type,
      stage: 'INDEXING',
      processingAttemptId,
      durationMs: indexingDurationMs,
      nextStage: 'COMPLETED',
    });
    currentStage = 'COMPLETED';
    stageStartedAt = Date.now();
    const totalDurationMs = Date.now() - pipelineStartedAt;

    // One consolidated timing breakdown per completed ingestion, correlated
    // by sourceId/version/processingAttemptId, so a slow ingestion can be
    // diagnosed from a single log line instead of reconstructing it from the
    // per-transition "Ingestion stage completed" lines above. FETCHING is the
    // transcript/remote-fetch stage (network-bound); CHUNKING/EMBEDDING are
    // measured around the actual computation, not the DB writes that
    // surround them (those land in PARSING/READY_FOR_INDEXING respectively).
    logger.info('Ingestion pipeline timing summary', {
      sourceId: options.sourceId,
      version,
      processingAttemptId,
      sourceType: options.type,
      workspaceId: options.workspaceId,
      queueWaitMs,
      queuedMs: stageDurationsMs.QUEUED ?? null,
      processingMs: stageDurationsMs.PROCESSING ?? null,
      fetchingMs: stageDurationsMs.FETCHING ?? null,
      parsingMs: stageDurationsMs.PARSING ?? null,
      chunkingMs: stageDurationsMs.CHUNKING ?? null,
      readyForIndexingMs: stageDurationsMs.READY_FOR_INDEXING ?? null,
      embeddingMs: stageDurationsMs.EMBEDDING ?? null,
      indexingMs: stageDurationsMs.INDEXING ?? null,
      totalDurationMs,
      chunkCount: committedIndex.chunkCount,
      tokenCount,
      ...(options.type === 'YOUTUBE'
        ? {
            transcriptProvider: parsed.metadata.transcriptProvider,
            transcriptStrategy: parsed.metadata.transcriptStrategy,
            transcriptAcquisitionMs: parsed.metadata.acquisitionDurationMs,
          }
        : {}),
    });

    logger.info('Completed ingestion attempt', {
      sourceId: options.sourceId,
      version,
      processingAttemptId,
      sourceType: options.type,
      chunkCount: committedIndex.chunkCount,
      tokenCount,
      durationMs: totalDurationMs,
    });
    return {
      success: true,
      claimed: true,
      chunkCount: committedIndex.chunkCount,
      tokenCount,
      provider: ingestionProvider,
      model: ingestionModel,
      ...(embeddingBatch.inputTokens !== undefined
        ? { inputTokens: embeddingBatch.inputTokens }
        : {}),
    };
  } catch (error: any) {
    const classification = classifyIngestionError(error);
    const failedStageDurationMs = Date.now() - stageStartedAt;
    logger.error('Ingestion attempt failed', error, {
      sourceId: options.sourceId,
      version,
      processingAttemptId,
      sourceType: options.type,
      stage: currentStage,
      stageDurationMs: failedStageDurationMs,
      totalDurationMs: Date.now() - pipelineStartedAt,
      queueWaitMs,
      // Timing for every stage that completed before the failure, so a slow
      // failure (e.g. a transcript-provider timeout) is diagnosable from
      // this one line without cross-referencing earlier "stage completed"
      // log lines. The failing stage itself is `stage`/`stageDurationMs` above.
      completedStageDurationsMs: stageDurationsMs,
      errorCode: classification.errorCode,
      errorCategory: classification.errorCategory,
      retryable: classification.retryable,
      provider: classification.provider,
      httpStatus: classification.httpStatus,
    });

    try {
      await transitionProcessingStage({
        sourceId: options.sourceId,
        version,
        nextStage: 'FAILED',
        errorMessage: classification.userMessage,
        details: {
          processingAttemptId,
          attemptNumber: version,
          errorCode: classification.errorCode,
          errorCategory: classification.errorCategory,
          retryable: classification.retryable,
          provider: classification.provider,
          httpStatus: classification.httpStatus,
          failedStage: currentStage,
          failedStageDurationMs,
          totalDurationMs: Date.now() - pipelineStartedAt,
        },
      });
    } catch (transitionError) {
      logger.error('Failed to persist ingestion failure state', transitionError, {
        sourceId: options.sourceId,
        version,
        sourceType: options.type,
        stage: currentStage,
      });
      throw transitionError;
    }

    return {
      success: false,
      claimed: true,
      chunkCount: 0,
      tokenCount: 0,
      error: classification.userMessage,
    };
  }
}

export const PROCESSING_STAGES: readonly ProcessingStage[] = [
  'CREATED',
  'QUEUED',
  'PROCESSING',
  'FETCHING',
  'PARSING',
  'CHUNKING',
  'READY_FOR_INDEXING',
  'EMBEDDING',
  'INDEXING',
  'COMPLETED',
  'FAILED',
];
