import assert from 'node:assert/strict';
import test from 'node:test';
import { YoutubeTranscriptDisabledError } from 'youtube-transcript';
import { IngestionFailure } from './errors';
import { GeminiYouTubeAcquisitionError } from './gemini-youtube-acquisition';
import { fetchYouTubeTranscript } from './youtube-transcript-provider';

test('direct YouTube provider preserves validated cue timing and language', async () => {
  const result = await fetchYouTubeTranscript(
    'dQw4w9WgXcQ',
    { provider: 'direct', timeoutMs: 5_000 },
    {
      directFetch: async () => [
        { text: 'Welcome', offset: 1_000, duration: 2_500, lang: 'en' },
      ],
    },
  );
  assert.equal(result.provider, 'direct');
  assert.equal(result.language, 'en');
  assert.deepEqual(result.cues[0], {
    text: 'Welcome',
    offset: 1_000,
    duration: 2_500,
    lang: 'en',
  });
});

test('direct YouTube provider distinguishes unavailable transcripts from provider failures', async () => {
  await assert.rejects(
    fetchYouTubeTranscript(
      'dQw4w9WgXcQ',
      { provider: 'direct', timeoutMs: 5_000 },
      {
        directFetch: async () => {
          throw new YoutubeTranscriptDisabledError('dQw4w9WgXcQ');
        },
      },
    ),
    (error: unknown) =>
      error instanceof IngestionFailure &&
      error.errorCode === 'TRANSCRIPT_UNAVAILABLE' &&
      error.provider === 'direct' &&
      error.retryable === false,
  );

  await assert.rejects(
    fetchYouTubeTranscript(
      'dQw4w9WgXcQ',
      { provider: 'direct', timeoutMs: 5_000 },
      {
        directFetch: async () => {
          throw new Error('network reset');
        },
      },
    ),
    (error: unknown) =>
      error instanceof IngestionFailure &&
      error.errorCode === 'TRANSCRIPT_PROVIDER_ERROR' &&
      error.provider === 'direct' &&
      error.retryable === true,
  );
});

test('reference YouTube provider times out and rejects empty or malformed segments', async () => {
  await assert.rejects(
    fetchYouTubeTranscript(
      'dQw4w9WgXcQ',
      { provider: 'direct', timeoutMs: 10 },
      { directFetch: async () => new Promise(() => undefined) },
    ),
    (error: unknown) =>
      error instanceof IngestionFailure &&
      error.errorCode === 'TRANSCRIPT_PROVIDER_ERROR' &&
      error.retryable === true &&
      /timed out/i.test(error.userMessage),
  );

  await assert.rejects(
    fetchYouTubeTranscript(
      'dQw4w9WgXcQ',
      { provider: 'direct', timeoutMs: 5_000 },
      { directFetch: async () => [] },
    ),
    (error: unknown) =>
      error instanceof IngestionFailure &&
      error.errorCode === 'TRANSCRIPT_UNAVAILABLE',
  );

  await assert.rejects(
    fetchYouTubeTranscript(
      'dQw4w9WgXcQ',
      { provider: 'direct', timeoutMs: 5_000 },
      {
        directFetch: async () => [
          { text: '', offset: 0, duration: 1_000, lang: 'en' },
        ],
      },
    ),
    (error: unknown) =>
      error instanceof IngestionFailure &&
      error.errorCode === 'TRANSCRIPT_PROVIDER_ERROR',
  );
});

test('normal YouTube provider adapts Gemini seconds into Lumora millisecond cues', async () => {
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };
  Object.assign(process.env, {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    CLERK_SECRET_KEY: 'test-clerk-secret',
    VITE_CLERK_PUBLISHABLE_KEY: 'test-clerk-publishable',
    GEMINI_API_KEY: 'test-gemini-key',
    NODE_ENV: 'test',
  });
  try {
    let receivedUrl = '';
    const result = await fetchYouTubeTranscript('-moW9jvvMr4', undefined, {
      geminiAcquire: async (input) => {
        receivedUrl = input.youtubeUrl;
        return {
          language: 'en',
          segments: [
            { text: 'Opening', startSeconds: 1.25, endSeconds: 3.75 },
          ],
        };
      },
    });
    assert.equal(receivedUrl, 'https://www.youtube.com/watch?v=-moW9jvvMr4');
    assert.equal(result.provider, 'gemini');
    assert.equal(result.strategy, 'gemini_native');
    assert.equal(result.language, 'en');
    assert.deepEqual(result.cues, [
      { text: 'Opening', offset: 1_250, duration: 2_500, lang: 'en' },
    ]);

    await assert.rejects(
      fetchYouTubeTranscript('-moW9jvvMr4', undefined, {
        geminiAcquire: async () => {
          throw new GeminiYouTubeAcquisitionError(
            'NO_SPEECH_DETECTED',
            'No speech after verification.',
            false,
          );
        },
      }),
      (error: unknown) =>
        error instanceof IngestionFailure &&
        error.errorCode === 'NO_SPEECH_DETECTED' &&
        error.retryable === false &&
        /No usable spoken content/i.test(error.userMessage),
    );
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('configured transcript fast path succeeds without calling Gemini', async () => {
  let geminiCalls = 0;
  let proxyCalls = 0;
  const result = await fetchYouTubeTranscript('dQw4w9WgXcQ', undefined, {
    runtimeConfig: {
      geminiApiKey: 'test-gemini-key',
      fastPath: {
        provider: 'proxy',
        timeoutMs: 5_000,
        proxyUrl: 'https://transcript-proxy.example.com/v1/transcript',
        proxyToken: 'server-secret',
        maxAttempts: 1,
      },
    },
    validateEndpoint: async (value) => new URL(value),
    fetchImpl: async () => {
      proxyCalls += 1;
      return new Response(JSON.stringify({
        language: 'en',
        cues: [{ text: 'Fast transcript', offset: 0, duration: 1_500, lang: 'en' }],
      }), { status: 200 });
    },
    geminiAcquire: async () => {
      geminiCalls += 1;
      return { language: 'en', segments: [] };
    },
  });

  assert.equal(result.strategy, 'transcript_fast_path');
  assert.equal(result.provider, 'proxy');
  assert.equal(proxyCalls, 1);
  assert.equal(geminiCalls, 0);
});

test('unavailable or unusable transcript fast path falls back to Gemini once', async (context) => {
  for (const scenario of [
    { name: 'unavailable', response: new Response('', { status: 404 }) },
    { name: 'empty', response: new Response(JSON.stringify({ cues: [] }), { status: 200 }) },
  ]) {
    await context.test(scenario.name, async () => {
      let proxyCalls = 0;
      let geminiCalls = 0;
      const result = await fetchYouTubeTranscript('dQw4w9WgXcQ', undefined, {
        runtimeConfig: {
          geminiApiKey: 'test-gemini-key',
          fastPath: {
            provider: 'proxy',
            timeoutMs: 5_000,
            proxyUrl: 'https://transcript-proxy.example.com/v1/transcript',
            proxyToken: 'server-secret',
            maxAttempts: 1,
          },
        },
        validateEndpoint: async (value) => new URL(value),
        fetchImpl: async () => {
          proxyCalls += 1;
          return scenario.response.clone();
        },
        geminiAcquire: async () => {
          geminiCalls += 1;
          return {
            language: 'en',
            segments: [{ text: 'Gemini fallback', startSeconds: 0, endSeconds: 2 }],
          };
        },
      });

      assert.equal(result.strategy, 'gemini_native');
      assert.equal(result.provider, 'gemini');
      assert.equal(proxyCalls, 1);
      assert.equal(geminiCalls, 1);
    });
  }
});

test('acquisition strategy logs timings, counts, and text length without transcript content', async () => {
  const entries: Array<{ event: string; meta?: Record<string, unknown> }> = [];
  const transcriptText = 'Sensitive transcript text';
  await fetchYouTubeTranscript('dQw4w9WgXcQ', undefined, {
    runtimeConfig: {
      geminiApiKey: 'test-gemini-key',
      fastPath: {
        provider: 'proxy',
        timeoutMs: 5_000,
        proxyUrl: 'https://transcript-proxy.example.com/v1/transcript',
        proxyToken: 'server-secret',
        maxAttempts: 1,
      },
    },
    validateEndpoint: async (value) => new URL(value),
    fetchImpl: async () => new Response(JSON.stringify({
      language: 'en',
      cues: [{ text: transcriptText, offset: 0, duration: 1_000, lang: 'en' }],
    }), { status: 200 }),
    logger: { info: (event, meta) => entries.push({ event, meta }) },
  });

  const result = entries.find((entry) => entry.event === 'YOUTUBE_ACQUISITION_STRATEGY_RESULT');
  assert.equal(result?.meta?.strategy, 'transcript_fast_path');
  assert.equal(result?.meta?.segmentCount, 1);
  assert.equal(result?.meta?.textLength, transcriptText.length);
  assert.equal(typeof result?.meta?.durationMs, 'number');
  assert.doesNotMatch(JSON.stringify(entries), new RegExp(transcriptText));
});

test('proxy YouTube provider authenticates server-side and rejects incomplete cues', async () => {
  let authorization = '';
  let requestBody = '';
  const config = {
    provider: 'proxy' as const,
    timeoutMs: 5_000,
    proxyUrl: 'https://transcript-proxy.example.com/v1/transcript',
    proxyToken: 'server-secret',
  };
  const validateEndpoint = async (value: string) => new URL(value);

  const result = await fetchYouTubeTranscript('dQw4w9WgXcQ', config, {
    validateEndpoint,
    fetchImpl: async (_url, init) => {
      authorization = String((init?.headers as Record<string, string>).Authorization);
      requestBody = String(init?.body);
      return new Response(JSON.stringify({
        language: 'en',
        cues: [{ text: 'Grounded transcript', offset: 0, duration: 1_500, lang: 'en' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  assert.equal(authorization, 'Bearer server-secret');
  assert.deepEqual(JSON.parse(requestBody), { videoId: 'dQw4w9WgXcQ' });
  assert.equal(result.provider, 'proxy');
  assert.equal(result.cues.length, 1);

  await assert.rejects(
    fetchYouTubeTranscript('dQw4w9WgXcQ', config, {
      validateEndpoint,
      fetchImpl: async () => new Response(JSON.stringify({
        cues: [{ text: '', offset: 0, duration: 1_500 }],
      }), { status: 200 }),
    }),
    (error: unknown) =>
      error instanceof IngestionFailure &&
      error.errorCode === 'TRANSCRIPT_PROVIDER_ERROR',
  );
});

test('proxy YouTube provider retries transient HTTP failures and exposes status only', async () => {
  let attempts = 0;
  await assert.rejects(
    fetchYouTubeTranscript(
      'dQw4w9WgXcQ',
      {
        provider: 'proxy',
        timeoutMs: 5_000,
        proxyUrl: 'https://transcript-proxy.example.com/v1/transcript',
        proxyToken: 'server-secret',
      },
      {
        validateEndpoint: async (value) => new URL(value),
        fetchImpl: async () => {
          attempts += 1;
          return new Response('', { status: 503 });
        },
      },
    ),
    (error: unknown) =>
      error instanceof IngestionFailure &&
      error.errorCode === 'TRANSCRIPT_PROVIDER_ERROR' &&
      error.httpStatus === 503 &&
      error.provider === 'proxy',
  );
  assert.equal(attempts, 3);
});
