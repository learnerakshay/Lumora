import { AppError } from '../errors';

export type IngestionErrorCode =
  | 'VALIDATION_ERROR'
  | 'PARSING_ERROR'
  | 'FETCH_ERROR'
  | 'FETCH_INVALID_URL'
  | 'FETCH_TIMEOUT'
  | 'FETCH_ORIGIN_UNREACHABLE'
  | 'FETCH_ORIGIN_BLOCKED'
  | 'FETCH_UNSUPPORTED_CONTENT_TYPE'
  | 'FETCH_REDIRECT_ERROR'
  | 'FETCH_RESPONSE_TOO_LARGE'
  | 'WEBSITE_CHALLENGE_PAGE'
  | 'WEBSITE_AUTH_REQUIRED'
  | 'WEBSITE_INSUFFICIENT_CONTENT'
  | 'TRANSCRIPT_UNAVAILABLE'
  | 'TRANSCRIPT_PROVIDER_ERROR'
  | 'NO_SPEECH_DETECTED'
  | 'VIDEO_UNAVAILABLE'
  | 'CHUNKING_ERROR'
  | 'EMBEDDING_ERROR'
  | 'INDEXING_ERROR'
  | 'STALE_ATTEMPT_RECOVERED'
  | 'SOURCE_ARTIFACT_MISSING'
  | 'UNKNOWN_ERROR';

export interface IngestionErrorClassification {
  errorCode: IngestionErrorCode;
  errorCategory: IngestionErrorCode;
  userMessage: string;
  retryable: boolean;
  provider?: string;
  httpStatus?: number;
}

export class IngestionFailure extends Error {
  readonly errorCode: IngestionErrorCode;
  readonly retryable: boolean;
  readonly provider?: string;
  readonly httpStatus?: number;
  readonly userMessage: string;

  constructor(input: {
    message: string;
    errorCode: IngestionErrorCode;
    userMessage: string;
    retryable?: boolean;
    provider?: string;
    httpStatus?: number;
    cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = 'IngestionFailure';
    this.errorCode = input.errorCode;
    this.userMessage = input.userMessage;
    this.retryable = input.retryable ?? false;
    this.provider = input.provider;
    this.httpStatus = input.httpStatus;
  }
}

const VALIDATION_ERROR_CODES = new Set([
  'INVALID_SOURCE_INPUT',
  'INVALID_SOURCE_METADATA',
  'INVALID_SOURCE_TYPE',
  'INVALID_YOUTUBE_URL',
  'INVALID_VTT_ENCODING',
]);
const PARSING_ERROR_MARKERS = [
  'parser produced empty content',
  'parser did not enter',
  'parsing failed',
  'contains no extractable text',
  'contains no readable text',
  'contains no valid caption cues',
  'must begin with a webvtt header',
  'timestamp',
  'invalid vtt',
];
const FETCH_ERROR_MARKERS = [
  'fetch',
  'timed out',
  'failed to fetch',
  'network',
  'service unavailable',
  'http',
  'timeout',
];
const TRANSCRIPT_ERROR_MARKERS = [
  'transcript is unavailable',
  'transcript retrieval',
  'transcript unavailable',
  'transcript empty',
];
const CHUNKING_ERROR_MARKERS = ['chunking produced', 'zero valid content segments'];
const EMBEDDING_ERROR_MARKERS = ['embedding', 'non-finite', 'zero vector'];
const INDEXING_ERROR_MARKERS = [
  'chunk persistence',
  'index verification',
  'active index',
  'index did not',
];

function classification(
  errorCode: IngestionErrorCode,
  userMessage: string,
  retryable: boolean,
): IngestionErrorClassification {
  return { errorCode, errorCategory: errorCode, userMessage, retryable };
}

export function classifyIngestionError(error: unknown): IngestionErrorClassification {
  if (error instanceof IngestionFailure) {
    return {
      errorCode: error.errorCode,
      errorCategory: error.errorCode,
      userMessage: error.userMessage,
      retryable: error.retryable,
      ...(error.provider ? { provider: error.provider } : {}),
      ...(error.httpStatus !== undefined ? { httpStatus: error.httpStatus } : {}),
    };
  }

  if (error instanceof AppError && VALIDATION_ERROR_CODES.has(error.code)) {
    return classification('VALIDATION_ERROR', error.message, false);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (TRANSCRIPT_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return classification(
        'TRANSCRIPT_UNAVAILABLE',
        'A transcript is not available for this YouTube video.',
        false,
      );
    }
    if (FETCH_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return classification(
        'FETCH_ERROR',
        'Lumora could not fetch the remote source. Please retry shortly.',
        true,
      );
    }
    if (PARSING_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return classification(
        'PARSING_ERROR',
        'Lumora could not extract readable content from this source.',
        false,
      );
    }
    if (CHUNKING_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return classification(
        'CHUNKING_ERROR',
        'The extracted source did not contain enough usable content to index.',
        false,
      );
    }
    if (INDEXING_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return classification(
        'INDEXING_ERROR',
        'Lumora could not commit the source index. Please retry shortly.',
        true,
      );
    }
    if (EMBEDDING_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return classification(
        'EMBEDDING_ERROR',
        'Lumora could not prepare this source for search. Please retry shortly.',
        true,
      );
    }
  }

  return classification(
    'UNKNOWN_ERROR',
    'Lumora could not finish processing this source. Please retry shortly.',
    true,
  );
}
