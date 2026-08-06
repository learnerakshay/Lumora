import {
  getSourceArtifact,
  persistParsedSourceArtifact,
  ProcessingStage,
  SourceType,
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
  error?: string;
}> {
  const artifact = await getSourceArtifact(options.sourceId, options.version);
  if (!artifact) {
    throw new Error(`Persisted artifact not found for source ${options.sourceId}`);
  }
  const version = artifact.version;

  logger.info(
    `Starting ingestion for source [${options.sourceId}] version ${version} (${options.type})`,
  );

  try {
    await transitionProcessingStage({
      sourceId: options.sourceId,
      version,
      nextStage: 'QUEUED',
    });
    await transitionProcessingStage({
      sourceId: options.sourceId,
      version,
      nextStage: 'PROCESSING',
    });

    const needsFetch = requiresRemoteFetch(options.type, artifact);
    let parsingTransitionCompleted = false;
    if (needsFetch) {
      await transitionProcessingStage({
        sourceId: options.sourceId,
        version,
        nextStage: 'FETCHING',
      });
    } else {
      await transitionProcessingStage({
        sourceId: options.sourceId,
        version,
        nextStage: 'PARSING',
      });
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
          await transitionProcessingStage({
            sourceId: options.sourceId,
            version,
            nextStage: 'PARSING',
          });
          parsingTransitionCompleted = true;
        }
      },
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

    await transitionProcessingStage({
      sourceId: options.sourceId,
      version,
      nextStage: 'CHUNKING',
      details: {
        parserVersion: parsed.parserVersion,
        parsedTitle: parsed.title,
        textLength: parsed.cleanText.length,
        url: parsed.sourceUrl || null,
        fileSize: parsed.artifactSize
          ? `${(parsed.artifactSize / 1024).toFixed(1)} KB`
          : null,
      },
    });

    const chunks = generateSemanticChunks(parsed.cleanText, {
      targetChunkSize: 1200,
      overlapSize: 200,
    });
    if (chunks.length === 0) {
      throw new Error('Chunking produced zero valid content segments');
    }

    await transitionProcessingStage({
      sourceId: options.sourceId,
      version,
      nextStage: 'READY_FOR_INDEXING',
      details: { chunkCount: chunks.length },
    });
    await transitionProcessingStage({
      sourceId: options.sourceId,
      version,
      nextStage: 'EMBEDDING',
      details: { chunkCount: chunks.length },
    });

    const embeddingBatch = await generateEmbeddingsBatch(
      chunks.map((chunk) => chunk.content),
    );
    if (
      embeddingBatch.vectors.length !== chunks.length
    ) {
      throw new Error('Embedding generation did not return one vector per chunk');
    }

    await transitionProcessingStage({
      sourceId: options.sourceId,
      version,
      nextStage: 'INDEXING',
      details: {
        chunkCount: chunks.length,
        embeddingProvider: embeddingBatch.contract.provider,
        embeddingModel: embeddingBatch.contract.model,
        embeddingVersion: embeddingBatch.contract.version,
        vectorDimensions: embeddingBatch.contract.dimensions,
        chunkVersion: CHUNK_VERSION,
      },
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
    await transitionProcessingStage({
      sourceId: options.sourceId,
      version,
      nextStage: 'COMPLETED',
      details: {
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
      },
    });

    logger.info(
      `Completed ingestion for source [${options.sourceId}] version ${version}`,
    );
    return { success: true, chunkCount: committedIndex.chunkCount, tokenCount };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unexpected ingestion failure';
    const classification = classifyIngestionError(error);
    logger.error(
      `Ingestion failed for source [${options.sourceId}] version ${version}`,
      error,
    );

    try {
      await transitionProcessingStage({
        sourceId: options.sourceId,
        version,
        nextStage: 'FAILED',
        errorMessage,
        details: {
          errorCode: classification.errorCode,
          errorCategory: classification.errorCategory,
        },
      });
    } catch (transitionError) {
      logger.error(
        `Failed to persist FAILED state for source [${options.sourceId}]`,
        transitionError,
      );
      throw transitionError;
    }

    return {
      success: false,
      chunkCount: 0,
      tokenCount: 0,
      error: errorMessage,
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
