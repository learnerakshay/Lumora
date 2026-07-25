import { SourceType, updateSource, getWorkspaceSources } from '../source-store';
import { validateSourceInput } from './validators';
import { parseSourceContent } from './parsers';
import { cleanExtractedText } from './cleaner';
import { generateSemanticChunks } from './chunker';
import { generateEmbeddingsBatch } from './embedder';
import { saveSourceChunks } from '../chunk-store';
import { logger } from '../logger';

export interface IngestionOptions {
  sourceId: string;
  workspaceId: string;
  title: string;
  type: SourceType;
  url?: string | null;
  fileSize?: string | null;
  rawContent?: string | null;
}

export async function processSourcePipeline(options: IngestionOptions): Promise<{
  success: boolean;
  chunkCount: number;
  tokenCount: number;
  error?: string;
}> {
  const { sourceId, workspaceId, title, type, url, fileSize, rawContent } = options;

  logger.info(`Starting Ingestion Pipeline for Source [${sourceId}] (${type}): "${title}"`);

  try {
    // 1. Stage: QUEUED
    await updateSourceStage(sourceId, 'QUEUED', 5);

    // 2. Stage: FETCHING (for YouTube / web / remote content) or PARSING
    if (type === 'YOUTUBE' || type === 'WEBSITE' || type === 'VTT') {
      await updateSourceStage(sourceId, 'FETCHING', 15);
    } else {
      await updateSourceStage(sourceId, 'PARSING', 25);
    }

    const parsed = await parseSourceContent({
      type,
      title,
      url,
      rawContent,
    });

    if (type === 'YOUTUBE' || type === 'WEBSITE' || type === 'VTT') {
      await updateSourceStage(sourceId, 'PARSING', 30);
    }

    if (!parsed.cleanText || parsed.cleanText.trim().length === 0) {
      throw new Error(`Failed to extract readable content from ${type} source.`);
    }

    // 3. Stage: CLEANING
    await updateSourceStage(sourceId, 'CLEANING', 45);
    const cleanedText = cleanExtractedText(parsed.cleanText);

    // 4. Stage: CHUNKING
    await updateSourceStage(sourceId, 'CHUNKING', 60);
    const chunks = generateSemanticChunks(cleanedText, {
      targetChunkSize: 1200,
      overlapSize: 200,
    });

    if (chunks.length === 0) {
      throw new Error('Text chunking produced zero valid semantic segments.');
    }

    // 5. Stage: EMBEDDING
    await updateSourceStage(sourceId, 'EMBEDDING', 75, { chunkCount: chunks.length });
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddingsBatch(chunkTexts);

    // Attach vectors to chunks
    const chunksWithEmbeddings = chunks.map((chunk, idx) => ({
      ...chunk,
      embedding: embeddings[idx] || [],
    }));

    // 6. Stage: INDEXING (Vector Storage)
    await updateSourceStage(sourceId, 'INDEXING', 90, { chunkCount: chunks.length });
    const savedChunks = await saveSourceChunks(workspaceId, sourceId, chunksWithEmbeddings);

    const totalTokens = savedChunks.reduce((acc, curr) => acc + curr.tokenCount, 0);

    // 7. Stage: INDEXED & COMPLETED
    await updateSource(sourceId, {
      status: 'COMPLETED',
      metadata: {
        stage: 'INDEXED',
        stageProgress: 100,
        chunkCount: savedChunks.length,
        tokenCount: totalTokens,
        textLength: cleanedText.length,
        fileSize: fileSize || `${(cleanedText.length / 1024).toFixed(1)} KB`,
        url: url || null,
        parsedTitle: parsed.title,
        processedAt: new Date().toISOString(),
        errorMessage: null,
      },
    });

    logger.info(`Successfully Ingested & Indexed Source [${sourceId}] with ${savedChunks.length} vectors (${totalTokens} tokens, ${cleanedText.length} chars)`);

    return {
      success: true,
      chunkCount: savedChunks.length,
      tokenCount: totalTokens,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'An unexpected error occurred during ingestion.';
    logger.error(`Ingestion Pipeline Failed for Source [${sourceId}]: ${errorMsg}`, err);

    await updateSource(sourceId, {
      status: 'FAILED',
      metadata: {
        stage: 'FAILED',
        stageProgress: 0,
        errorMessage: errorMsg,
        failedAt: new Date().toISOString(),
      },
    });

    return {
      success: false,
      chunkCount: 0,
      tokenCount: 0,
      error: errorMsg,
    };
  }
}

async function updateSourceStage(
  sourceId: string,
  stageName: string,
  progressPct: number,
  extra: Record<string, any> = {}
) {
  try {
    await updateSource(sourceId, {
      status: 'PROCESSING',
      metadata: {
        stage: stageName,
        stageProgress: progressPct,
        ...extra,
      },
    });
  } catch (err) {
    logger.warn(`Failed to update stage ${stageName} for source ${sourceId}`, err);
  }
}

async function updateSourceMetadata(sourceId: string, metaPatch: Record<string, any>) {
  try {
    await updateSource(sourceId, { metadata: metaPatch });
  } catch (err) {
    logger.warn(`Failed to update metadata for source ${sourceId}`, err);
  }
}
