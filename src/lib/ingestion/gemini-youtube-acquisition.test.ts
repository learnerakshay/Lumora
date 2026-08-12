import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquireGeminiYouTubeTranscript,
  GEMINI_YOUTUBE_MODEL,
  GeminiYouTubeAcquisitionError,
} from './gemini-youtube-acquisition';

const VIDEO_ID = '-moW9jvvMr4';
const YOUTUBE_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const silentLogger = { info() {}, error() {} };

function validOutput() {
  return JSON.stringify({
    language: 'en',
    segments: [
      { text: 'Opening sentence.', startSeconds: 0, endSeconds: 8 },
      { text: 'Next sentence.', startSeconds: 8, endSeconds: 15.5 },
    ],
  });
}

test('Gemini acquisition sends video before prompt and accepts structured output', async () => {
  let capturedRequest: any;
  const result = await acquireGeminiYouTubeTranscript(
    { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
    {
      logger: silentLogger,
      createInteraction: async (request, options) => {
        capturedRequest = request;
        assert.equal(options.maxRetries, 0);
        assert.equal(options.timeout, 120_000);
        return { output_text: validOutput() };
      },
    },
  );

  assert.equal(capturedRequest.model, GEMINI_YOUTUBE_MODEL);
  assert.deepEqual(capturedRequest.input[0], { type: 'video', uri: YOUTUBE_URL });
  assert.equal(capturedRequest.input[1].type, 'text');
  assert.equal(capturedRequest.response_format.type, 'text');
  assert.equal(capturedRequest.response_format.mime_type, 'application/json');
  assert.deepEqual(capturedRequest.response_format.schema.required, ['language', 'segments']);
  assert.equal(capturedRequest.response_format.schema.additionalProperties, false);
  assert.equal(result.language, 'en');
  assert.equal(result.segments.length, 2);
});

test('Gemini acquisition rejects malformed JSON without retry', async () => {
  let attempts = 0;
  await assert.rejects(
    acquireGeminiYouTubeTranscript(
      { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
      {
        logger: silentLogger,
        retryBackoffMs: 0,
        createInteraction: async () => {
          attempts += 1;
          return { output_text: '{not-json' };
        },
      },
    ),
    (error: unknown) =>
      error instanceof GeminiYouTubeAcquisitionError &&
      error.classification === 'EXTRACTION_MALFORMED' &&
      error.retryable === false,
  );
  assert.equal(attempts, 1);
});

test('Gemini acquisition rejects undeclared response fields', async () => {
  await assert.rejects(
    acquireGeminiYouTubeTranscript(
      { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
      {
        logger: silentLogger,
        createInteraction: async () => ({
          output_text: JSON.stringify({
            language: 'en',
            segments: [{
              text: 'Speech',
              startSeconds: 0,
              endSeconds: 1,
              summary: 'undeclared',
            }],
          }),
        }),
      },
    ),
    (error: unknown) =>
      error instanceof GeminiYouTubeAcquisitionError &&
      error.classification === 'EXTRACTION_MALFORMED',
  );
});

test('Gemini acquisition classifies empty segments as no speech without retry', async () => {
  let attempts = 0;
  await assert.rejects(
    acquireGeminiYouTubeTranscript(
      { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
      {
        logger: silentLogger,
        createInteraction: async () => {
          attempts += 1;
          return { output_text: JSON.stringify({ language: 'en', segments: [] }) };
        },
      },
    ),
    (error: unknown) =>
      error instanceof GeminiYouTubeAcquisitionError &&
      error.classification === 'NO_SPEECH_DETECTED',
  );
  assert.equal(attempts, 1);
});

test('Gemini acquisition retries one 429 then succeeds', async () => {
  let attempts = 0;
  const result = await acquireGeminiYouTubeTranscript(
    { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
    {
      logger: silentLogger,
      retryBackoffMs: 0,
      createInteraction: async () => {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error('quota exceeded'), { status: 429 });
        return { output_text: validOutput() };
      },
    },
  );
  assert.equal(attempts, 2);
  assert.equal(result.segments.length, 2);
});

test('Gemini acquisition times out after exactly one retry', async () => {
  let attempts = 0;
  await assert.rejects(
    acquireGeminiYouTubeTranscript(
      { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
      {
        logger: silentLogger,
        timeoutMs: 10,
        retryBackoffMs: 0,
        createInteraction: async () => {
          attempts += 1;
          return new Promise(() => undefined);
        },
      },
    ),
    (error: unknown) =>
      error instanceof GeminiYouTubeAcquisitionError &&
      error.classification === 'TIMEOUT',
  );
  assert.equal(attempts, 2);
});

test('Gemini acquisition does not retry an unavailable or private video', async () => {
  let attempts = 0;
  await assert.rejects(
    acquireGeminiYouTubeTranscript(
      { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
      {
        logger: silentLogger,
        createInteraction: async () => {
          attempts += 1;
          throw Object.assign(new Error('Private video cannot be accessed'), { status: 404 });
        },
      },
    ),
    (error: unknown) =>
      error instanceof GeminiYouTubeAcquisitionError &&
      error.classification === 'VIDEO_UNAVAILABLE' &&
      error.retryable === false,
  );
  assert.equal(attempts, 1);
});

test('Gemini acquisition rejects invalid and unordered timestamps', async (context) => {
  const invalidSegments = [
    [{ text: 'Invalid duration', startSeconds: 10, endSeconds: 9 }],
    [
      { text: 'Later', startSeconds: 10, endSeconds: 11 },
      { text: 'Earlier', startSeconds: 5, endSeconds: 6 },
    ],
    [{ text: 'Not finite', startSeconds: 0, endSeconds: Number.NaN }],
  ];
  for (const segments of invalidSegments) {
    await context.test('rejects invalid timestamp sequence', async () => {
      await assert.rejects(
        acquireGeminiYouTubeTranscript(
          { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
          {
            logger: silentLogger,
            createInteraction: async () => ({
              output_text: JSON.stringify({ language: 'en', segments }),
            }),
          },
        ),
        (error: unknown) =>
          error instanceof GeminiYouTubeAcquisitionError &&
          error.classification === 'EXTRACTION_MALFORMED',
      );
    });
  }
});
