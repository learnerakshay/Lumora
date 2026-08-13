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

function capturedLogger() {
  const entries: Array<{ event: string; meta?: Record<string, unknown> }> = [];
  return {
    entries,
    logger: {
      info(event: string, meta?: Record<string, unknown>) {
        entries.push({ event, meta });
      },
      error(event: string, _error?: unknown, meta?: Record<string, unknown>) {
        entries.push({ event, meta });
      },
    },
  };
}

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

test('Gemini acquisition recovers when the no-speech verification pass finds speech', async () => {
  const prompts: string[] = [];
  let attempts = 0;
  const result = await acquireGeminiYouTubeTranscript(
    { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
    {
      logger: silentLogger,
      createInteraction: async (request: any) => {
        attempts += 1;
        prompts.push(request.input[1].text);
        return {
          output_text: attempts === 1
            ? JSON.stringify({ language: 'en', segments: [] })
            : validOutput(),
        };
      },
    },
  );
  assert.equal(attempts, 2);
  assert.equal(result.segments.length, 2);
  assert.notEqual(prompts[0], prompts[1]);
  assert.match(prompts[1], /second, complete verification pass/i);
});

test('Gemini acquisition classifies no speech as permanent only after verification', async () => {
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
      error.classification === 'NO_SPEECH_DETECTED' &&
      error.retryable === false,
  );
  assert.equal(attempts, 2);
});

test('a no-speech result after a transient retry still receives one verification pass', async () => {
  let attempts = 0;
  const result = await acquireGeminiYouTubeTranscript(
    { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
    {
      logger: silentLogger,
      retryBackoffMs: 0,
      createInteraction: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw Object.assign(new Error('temporary provider failure'), { status: 503 });
        }
        if (attempts === 2) {
          return { output_text: JSON.stringify({ language: 'en', segments: [] }) };
        }
        return { output_text: validOutput() };
      },
    },
  );
  assert.equal(attempts, 3);
  assert.equal(result.segments.length, 2);
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

test('primary success emits final structured logs and never starts verification', async () => {
  const logs = capturedLogger();
  let requests = 0;
  const result = await acquireGeminiYouTubeTranscript(
    { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
    {
      logger: logs.logger,
      createInteraction: async () => {
        requests += 1;
        return { output_text: validOutput() };
      },
    },
  );
  assert.equal(result.segments.length, 2);
  assert.equal(requests, 1);
  assert.equal(
    logs.entries.filter(({ event }) => event === 'YOUTUBE_PRIMARY_ACQUISITION_STARTED').length,
    1,
  );
  assert.equal(
    logs.entries.filter(({ event }) => event === 'YOUTUBE_NO_SPEECH_VERIFICATION_STARTED').length,
    0,
  );
  assert.equal(
    logs.entries.find(({ event }) => event === 'YOUTUBE_PRIMARY_ACQUISITION_RESULT')?.meta?.segmentCount,
    2,
  );
  assert.deepEqual(
    logs.entries.find(({ event }) => event === 'YOUTUBE_FINAL_ACQUISITION_CLASSIFICATION')?.meta,
    {
      videoId: VIDEO_ID,
      recoveredFromPrimaryEmpty: false,
      primarySegmentCount: 2,
      verificationAttempted: false,
      verificationSegmentCount: null,
      finalClassification: 'SUCCESS',
      retryable: false,
    },
  );
});

test('primary empty and successful verification emit one complete recovery sequence', async () => {
  const logs = capturedLogger();
  let requests = 0;
  const result = await acquireGeminiYouTubeTranscript(
    { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
    {
      logger: logs.logger,
      createInteraction: async () => {
        requests += 1;
        return {
          output_text: requests === 1
            ? JSON.stringify({ language: 'en', segments: [] })
            : validOutput(),
        };
      },
    },
  );
  assert.equal(requests, 2);
  assert.equal(result.segments.length, 2);
  assert.equal(
    logs.entries.filter(({ event }) => event === 'YOUTUBE_NO_SPEECH_VERIFICATION_STARTED').length,
    1,
  );
  assert.equal(
    logs.entries.find(({ event }) => event === 'YOUTUBE_NO_SPEECH_VERIFICATION_RESULT')?.meta?.segmentCount,
    2,
  );
  assert.deepEqual(
    logs.entries.find(({ event }) => event === 'YOUTUBE_FINAL_ACQUISITION_CLASSIFICATION')?.meta,
    {
      videoId: VIDEO_ID,
      recoveredFromPrimaryEmpty: true,
      primarySegmentCount: 0,
      verificationAttempted: true,
      verificationSegmentCount: 2,
      finalClassification: 'SUCCESS',
      retryable: false,
    },
  );
});

test('verification no-speech and transient outcomes retain their exact final classification', async (context) => {
  await context.test('confirmed no speech remains non-retryable', async () => {
    const logs = capturedLogger();
    let requests = 0;
    await assert.rejects(
      acquireGeminiYouTubeTranscript(
        { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
        {
          logger: logs.logger,
          createInteraction: async () => {
            requests += 1;
            return { output_text: JSON.stringify({ language: 'en', segments: [] }) };
          },
        },
      ),
      (error: unknown) =>
        error instanceof GeminiYouTubeAcquisitionError &&
        error.classification === 'NO_SPEECH_DETECTED' &&
        error.retryable === false,
    );
    assert.equal(requests, 2);
    assert.deepEqual(
      logs.entries.find(({ event }) => event === 'YOUTUBE_FINAL_ACQUISITION_CLASSIFICATION')?.meta,
      {
        videoId: VIDEO_ID,
        recoveredFromPrimaryEmpty: false,
        primarySegmentCount: 0,
        verificationAttempted: true,
        verificationSegmentCount: 0,
        finalClassification: 'NO_SPEECH_DETECTED',
        retryable: false,
      },
    );
  });

  await context.test('verification provider failure is not swallowed', async () => {
    const logs = capturedLogger();
    let requests = 0;
    await assert.rejects(
      acquireGeminiYouTubeTranscript(
        { apiKey: 'test-key', videoId: VIDEO_ID, youtubeUrl: YOUTUBE_URL },
        {
          logger: logs.logger,
          createInteraction: async () => {
            requests += 1;
            if (requests === 1) {
              return { output_text: JSON.stringify({ language: 'en', segments: [] }) };
            }
            throw Object.assign(new Error('temporary provider failure'), { status: 503 });
          },
        },
      ),
      (error: unknown) =>
        error instanceof GeminiYouTubeAcquisitionError &&
        error.classification === 'UPSTREAM_FAILURE' &&
        error.retryable === true,
    );
    assert.equal(requests, 2);
    assert.equal(
      logs.entries.find(({ event }) => event === 'YOUTUBE_NO_SPEECH_VERIFICATION_RESULT')?.meta?.classification,
      'UPSTREAM_FAILURE',
    );
    assert.equal(
      logs.entries.find(({ event }) => event === 'YOUTUBE_FINAL_ACQUISITION_CLASSIFICATION')?.meta?.finalClassification,
      'UPSTREAM_FAILURE',
    );
  });
});
