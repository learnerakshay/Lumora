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

export interface IngestionOptions {
  sourceId: string;
  workspaceId: string;
  title: string;
  type: SourceType;
  version?: number;
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

export async function processSourcePipeline(options: IngestionOptions): Promise<{
  success: boolean;
  chunkCount: number;
  tokenCount: number;
  claimed: boolean;
  error?: string;
}> {
  const artifact = await getSourceArtifact(options.sourceId, options.version);
  if (!artifact) {
    throw new Error(`Persisted artifact not found for source ${options.sourceId}`);
  }
  const version = artifact.version;
  const claimed = await claimProcessingAttempt({ sourceId: options.sourceId, version });
  if (!claimed) {
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
  let currentStage: ProcessingStage = 'QUEUED';
  let stageStartedAt = Date.now();

  const enterStage = async (
    nextStage: ProcessingStage,
    details: Record<string, any> = {},
  ): Promise<void> => {
    const previousStage = currentStage;
    const previousStageDurationMs = Date.now() - stageStartedAt;
    logger.info('Ingestion stage completed', {
      sourceId: options.sourceId,
      version,
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

    const parsed = await parseSourceContent({
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
    });
    if (committedIndex.chunkCount !== chunks.length || committedIndex.chunkCount === 0) {
      throw new Error('Chunk persistence did not save the complete processed source');
    }

    const tokenCount = committedIndex.chunks.reduce(
      (total, chunk) => total + chunk.tokenCount,
      0,
    );
    await enterStage('COMPLETED', {
      chunkCount: committedIndex.chunkCount,
      tokenCount,
      textLength: parsed.cleanText.length,
      parserVersion: parsed.parserVersion,
      indexId: committedIndex.indexId,
      indexedAt: committedIndex.indexedAt,
      sourceVersion: committedIndex.sourceVersion,
      chunkVersion: committedIndex.chunkVersion,
      embeddingProvider: embeddingBatch.contract.provider,
      embeddingModel: embeddingBatch.contract.model,
      embeddingVersion: embeddingBatch.contract.version,
      vectorDimensions: embeddingBatch.contract.dimensions,
      totalDurationMs: Date.now() - pipelineStartedAt,
    });

    logger.info('Completed ingestion attempt', {
      sourceId: options.sourceId,
      version,
      sourceType: options.type,
      chunkCount: committedIndex.chunkCount,
      tokenCount,
      durationMs: Date.now() - pipelineStartedAt,
    });
    return {
      success: true,
      claimed: true,
      chunkCount: committedIndex.chunkCount,
      tokenCount,
    };
  } catch (error: any) {
    const classification = classifyIngestionError(error);
    const failedStageDurationMs = Date.now() - stageStartedAt;
    logger.error('Ingestion attempt failed', error, {
      sourceId: options.sourceId,
      version,
      sourceType: options.type,
      stage: currentStage,
      stageDurationMs: failedStageDurationMs,
      totalDurationMs: Date.now() - pipelineStartedAt,
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
