import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../errors';
import {
  classifyIngestionError,
  IngestionFailure,
} from './errors';

test('classifies known ingestion failures with user-safe retry metadata', () => {
  assert.deepEqual(classifyIngestionError(AppError.badRequest('bad input', 'INVALID_SOURCE_INPUT')), {
    errorCode: 'VALIDATION_ERROR',
    errorCategory: 'VALIDATION_ERROR',
    userMessage: 'bad input',
    retryable: false,
  });

  assert.deepEqual(classifyIngestionError(new Error('YouTube transcript is unavailable or empty')), {
    errorCode: 'TRANSCRIPT_UNAVAILABLE',
    errorCategory: 'TRANSCRIPT_UNAVAILABLE',
    userMessage: 'A transcript is not available for this YouTube video.',
    retryable: false,
  });

  assert.deepEqual(classifyIngestionError(new Error('Embedding provider failure: rate limited')), {
    errorCode: 'EMBEDDING_ERROR',
    errorCategory: 'EMBEDDING_ERROR',
    userMessage: 'Lumora could not prepare this source for search. Please retry shortly.',
    retryable: true,
  });
});

test('typed provider failures preserve safe operational metadata', () => {
  const classified = classifyIngestionError(new IngestionFailure({
    message: 'provider returned a private diagnostic',
    errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
    userMessage: 'The transcript provider is unavailable.',
    retryable: true,
    provider: 'proxy',
    httpStatus: 503,
  }));
  assert.deepEqual(classified, {
    errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
    errorCategory: 'TRANSCRIPT_PROVIDER_ERROR',
    userMessage: 'The transcript provider is unavailable.',
    retryable: true,
    provider: 'proxy',
    httpStatus: 503,
  });
});

test('falls back to a retryable user-safe unknown classification', () => {
  assert.deepEqual(classifyIngestionError(new Error('something unexpected happened')), {
    errorCode: 'UNKNOWN_ERROR',
    errorCategory: 'UNKNOWN_ERROR',
    userMessage: 'Lumora could not finish processing this source. Please retry shortly.',
    retryable: true,
  });
});

test('uses the persisted pipeline stage instead of misleading HTTP/fetch words', () => {
  assert.deepEqual(
    classifyIngestionError(
      new Error('PDF parser helper failed to fetch an internal font over HTTP'),
      {
        stage: 'PARSING',
        sourceType: 'PDF',
        acquisitionMode: 'UPLOADED_BYTES',
      },
    ),
    {
      errorCode: 'PARSING_ERROR',
      errorCategory: 'PARSING_ERROR',
      userMessage: 'Lumora received the PDF but could not extract readable content.',
      retryable: false,
    },
  );

  assert.equal(
    classifyIngestionError(new Error('OpenAI request failed over HTTP'), {
      stage: 'EMBEDDING',
      sourceType: 'PDF',
      acquisitionMode: 'UPLOADED_BYTES',
    }).errorCode,
    'EMBEDDING_ERROR',
  );

  assert.equal(
    classifyIngestionError(new Error('socket timeout'), {
      stage: 'FETCHING',
      sourceType: 'PDF',
      acquisitionMode: 'REMOTE_URL',
    }).errorCode,
    'FETCH_ERROR',
  );
});
