import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../errors';
import { classifyIngestionError } from './errors';

test('classifies known ingestion failures', () => {
  assert.deepEqual(classifyIngestionError(AppError.badRequest('bad input', 'INVALID_SOURCE_INPUT')), {
    errorCode: 'VALIDATION_ERROR',
    errorCategory: 'VALIDATION_ERROR',
  });

  assert.deepEqual(classifyIngestionError(new Error('YouTube transcript is unavailable or empty')), {
    errorCode: 'TRANSCRIPT_UNAVAILABLE',
    errorCategory: 'TRANSCRIPT_UNAVAILABLE',
  });

  assert.deepEqual(classifyIngestionError(new Error('Embedding provider failure: rate limited')), {
    errorCode: 'EMBEDDING_ERROR',
    errorCategory: 'EMBEDDING_ERROR',
  });
});

test('falls back to unknown error classification', () => {
  assert.deepEqual(classifyIngestionError(new Error('something unexpected happened')), {
    errorCode: 'UNKNOWN_ERROR',
    errorCategory: 'UNKNOWN_ERROR',
  });
});
