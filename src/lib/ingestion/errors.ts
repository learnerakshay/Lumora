import { AppError } from '../errors';

export type IngestionErrorCode =
  | 'VALIDATION_ERROR'
  | 'PARSING_ERROR'
  | 'FETCH_ERROR'
  | 'TRANSCRIPT_UNAVAILABLE'
  | 'CHUNKING_ERROR'
  | 'EMBEDDING_ERROR'
  | 'INDEXING_ERROR'
  | 'UNKNOWN_ERROR';

export interface IngestionErrorClassification {
  errorCode: IngestionErrorCode;
  errorCategory: IngestionErrorCode;
}

const VALIDATION_ERROR_CODES = new Set(['INVALID_SOURCE_INPUT', 'INVALID_SOURCE_METADATA', 'INVALID_SOURCE_TYPE', 'INVALID_YOUTUBE_URL', 'INVALID_VTT_ENCODING']);
const PARSING_ERROR_MARKERS = ['parser produced empty content', 'parser did not enter', 'parsing failed', 'contains no extractable text', 'contains no readable text', 'contains no valid caption cues', 'must begin with a WEBVTT header', 'timestamp', 'invalid vtt'];
const FETCH_ERROR_MARKERS = ['fetch', 'timed out', 'failed to fetch', 'network', 'service unavailable', 'http', 'timeout'];
const TRANSCRIPT_ERROR_MARKERS = ['transcript is unavailable', 'transcript retrieval', 'transcript unavailable', 'transcript empty'];
const CHUNKING_ERROR_MARKERS = ['chunking produced', 'zero valid content segments'];
const EMBEDDING_ERROR_MARKERS = ['embedding', 'vector index', 'non-finite', 'zero vector'];
const INDEXING_ERROR_MARKERS = ['chunk persistence', 'index verification', 'active index', 'index did not'];

export function classifyIngestionError(error: unknown): IngestionErrorClassification {
  if (error instanceof AppError) {
    if (VALIDATION_ERROR_CODES.has(error.code)) {
      return { errorCode: 'VALIDATION_ERROR', errorCategory: 'VALIDATION_ERROR' };
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (TRANSCRIPT_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return { errorCode: 'TRANSCRIPT_UNAVAILABLE', errorCategory: 'TRANSCRIPT_UNAVAILABLE' };
    }
    if (FETCH_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return { errorCode: 'FETCH_ERROR', errorCategory: 'FETCH_ERROR' };
    }
    if (PARSING_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return { errorCode: 'PARSING_ERROR', errorCategory: 'PARSING_ERROR' };
    }
    if (CHUNKING_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return { errorCode: 'CHUNKING_ERROR', errorCategory: 'CHUNKING_ERROR' };
    }
    if (EMBEDDING_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return { errorCode: 'EMBEDDING_ERROR', errorCategory: 'EMBEDDING_ERROR' };
    }
    if (INDEXING_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return { errorCode: 'INDEXING_ERROR', errorCategory: 'INDEXING_ERROR' };
    }
  }

  return { errorCode: 'UNKNOWN_ERROR', errorCategory: 'UNKNOWN_ERROR' };
}
