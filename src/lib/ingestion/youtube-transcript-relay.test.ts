import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import {
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
  type TranscriptSegment,
} from 'youtube-transcript-plus';
import {
  classifyExtractionError,
  createVercelYouTubeTranscriptHandler,
} from '../../../api/youtube-transcript';
import { fetchYouTubeTranscript } from './youtube-transcript-provider';

const VIDEO_ID = '-moW9jvvMr4';
const TOKEN = 'relay-test-secret';

interface LogMetadata {
  bodyPresent?: boolean;
  bodyType?: string;
  videoIdPresent?: boolean;
}

function nodeRequest(body: unknown, token?: string): IncomingMessage & { body?: unknown } {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body,
  } as unknown as IncomingMessage & { body?: unknown };
}

function nodeResponse() {
  const headers = new Map<string, string | number | readonly string[]>();
  const chunks: Buffer[] = [];
  let finish!: () => void;
  const completed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const response = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    end(chunk?: string | Uint8Array) {
      if (chunk) chunks.push(Buffer.from(chunk));
      this.headersSent = true;
      this.writableEnded = true;
      finish();
      return this;
    },
  } as unknown as ServerResponse;
  return {
    response,
    completed,
    body: () => Buffer.concat(chunks).toString('utf8'),
    headers,
  };
}

async function withoutHanging<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Vercel handler did not complete')), 250);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

test('parsed Vercel JSON reaches extraction with the exact videoId and returns relay cues', async () => {
  let receivedVideoId = '';
  const requestLogs: LogMetadata[] = [];
  const handler = createVercelYouTubeTranscriptHandler({
    getSecret: () => TOKEN,
    transcriptFetch: async (videoId) => {
      receivedVideoId = videoId;
      return [{ text: '  Production cue  ', offset: 1.25, duration: 2.5, lang: 'en' }];
    },
    timeoutMs: 1_000,
    logger: {
      info(event, metadata) {
        if (event === 'youtube_transcript_relay_request') {
          requestLogs.push(metadata as LogMetadata);
        }
      },
      error() {},
    },
  });
  const result = nodeResponse();

  assert.equal(handler.length, 2);
  await withoutHanging(handler(nodeRequest({ videoId: VIDEO_ID }, TOKEN), result.response));
  await withoutHanging(result.completed);

  assert.equal(receivedVideoId, VIDEO_ID);
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.response.writableEnded, true);
  assert.deepEqual(requestLogs, [{
    bodyPresent: true,
    bodyType: 'object',
    videoIdPresent: true,
  }]);
  assert.deepEqual(JSON.parse(result.body()), {
    language: 'en',
    cues: [{ text: 'Production cue', offset: 1_250, duration: 2_500, lang: 'en' }],
  });
});

test('unauthorized request returns 401 without reaching extraction', async () => {
  let called = false;
  const handler = createVercelYouTubeTranscriptHandler({
    getSecret: () => TOKEN,
    transcriptFetch: async () => {
      called = true;
      return [];
    },
    logger: { info() {}, error() {} },
  });
  const result = nodeResponse();

  await withoutHanging(handler(nodeRequest({ videoId: VIDEO_ID }), result.response));

  assert.equal(result.response.statusCode, 401);
  assert.equal(result.response.writableEnded, true);
  assert.equal(called, false);
  assert.equal(JSON.parse(result.body()).error.code, 'UNAUTHORIZED');
});

test('invalid parsed bodies and video IDs return 400 without extraction', async (context) => {
  for (const body of [undefined, '{"videoId":"-moW9jvvMr4"}', {}, { videoId: 'bad-id' }]) {
    await context.test(`rejects ${body === undefined ? 'missing body' : typeof body}`, async () => {
      let called = false;
      const handler = createVercelYouTubeTranscriptHandler({
        getSecret: () => TOKEN,
        transcriptFetch: async () => {
          called = true;
          return [];
        },
        logger: { info() {}, error() {} },
      });
      const result = nodeResponse();

      await withoutHanging(handler(nodeRequest(body, TOKEN), result.response));

      assert.equal(result.response.statusCode, 400);
      assert.equal(result.response.writableEnded, true);
      assert.equal(called, false);
    });
  }
});

test('handler terminates even if writing the classified response initially fails', async () => {
  const handler = createVercelYouTubeTranscriptHandler({
    getSecret: () => TOKEN,
    transcriptFetch: async () => {
      throw new Error('upstream failure');
    },
    logger: { info() {}, error() {} },
  });
  const result = nodeResponse();
  const originalSetHeader = result.response.setHeader.bind(result.response);
  let failOnce = true;
  result.response.setHeader = ((name: string, value: string | number | readonly string[]) => {
    if (failOnce) {
      failOnce = false;
      throw new Error('simulated header failure');
    }
    return originalSetHeader(name, value);
  }) as ServerResponse['setHeader'];

  await withoutHanging(handler(nodeRequest({ videoId: VIDEO_ID }, TOKEN), result.response));
  await withoutHanging(result.completed);

  assert.equal(result.response.writableEnded, true);
});

test('existing Render proxy provider consumes the native relay response contract', async () => {
  const handler = createVercelYouTubeTranscriptHandler({
    getSecret: () => TOKEN,
    transcriptFetch: async (): Promise<TranscriptSegment[]> => [
      { text: 'Relay contract', offset: 0, duration: 1.5, lang: 'en' },
    ],
    logger: { info() {}, error() {} },
  });

  const result = await fetchYouTubeTranscript(
    VIDEO_ID,
    {
      provider: 'proxy',
      timeoutMs: 1_000,
      proxyUrl: 'https://lumora-vercel.example/api/youtube-transcript',
      proxyToken: TOKEN,
    },
    {
      validateEndpoint: async (value) => new URL(value),
      fetchImpl: async (_input, init) => {
        const result = nodeResponse();
        const requestBody = JSON.parse(String(init?.body));
        await handler(nodeRequest(requestBody, TOKEN), result.response);
        return new Response(result.body(), {
          status: result.response.statusCode,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  );

  assert.equal(result.provider, 'proxy');
  assert.equal(result.language, 'en');
  assert.deepEqual(result.cues, [
    { text: 'Relay contract', offset: 0, duration: 1_500, lang: 'en' },
  ]);
});

// youtube-transcript-plus throws the same YoutubeTranscriptVideoUnavailableError /
// YoutubeTranscriptNotAvailableError for a real 404 and for a 429/403/5xx that
// survived its own internal retry — the classes carry no HTTP status of their
// own. `upstreamStatus`, captured by this module's own tracking fetch hooks,
// is what lets the relay recover that distinction instead of reporting every
// case as "no transcript available".
test('ambiguous "unavailable" errors are reclassified using the real upstream HTTP status', async (context) => {
  const ambiguousErrorFactories = [
    () => new YoutubeTranscriptVideoUnavailableError(VIDEO_ID),
    () => new YoutubeTranscriptNotAvailableError(VIDEO_ID),
  ];

  for (const makeError of ambiguousErrorFactories) {
    await context.test(`${makeError().name} + 429 -> rate limited, not unavailable`, () => {
      const failure = classifyExtractionError(makeError(), false, 429);
      assert.equal(failure.status, 429);
      assert.equal(failure.code, 'UPSTREAM_RATE_LIMITED');
    });

    await context.test(`${makeError().name} + 403 -> blocked, not unavailable`, () => {
      const failure = classifyExtractionError(makeError(), false, 403);
      assert.equal(failure.status, 503);
      assert.equal(failure.code, 'UPSTREAM_BLOCKED');
    });

    await context.test(`${makeError().name} + 500 -> transient upstream error, not unavailable`, () => {
      const failure = classifyExtractionError(makeError(), false, 500);
      assert.equal(failure.status, 502);
      assert.equal(failure.code, 'UPSTREAM_TRANSIENT_ERROR');
    });

    await context.test(`${makeError().name} + 404 -> stays unavailable (a real "not found")`, () => {
      const failure = classifyExtractionError(makeError(), false, 404);
      assert.equal(failure.status, 404);
      assert.equal(failure.code, 'TRANSCRIPT_UNAVAILABLE');
    });

    await context.test(`${makeError().name} + no observed status -> stays unavailable (unchanged behavior)`, () => {
      const failure = classifyExtractionError(makeError(), false, undefined);
      assert.equal(failure.status, 404);
      assert.equal(failure.code, 'TRANSCRIPT_UNAVAILABLE');
    });
  }
});

test('captions genuinely disabled or an unavailable language are never reclassified by upstream status', () => {
  // Unlike VideoUnavailableError/NotAvailableError, these are thrown from
  // successfully-parsed player JSON content (not a raw non-ok HTTP
  // response), so they are already a genuine content-level fact regardless
  // of what status the surrounding requests happened to return.
  const disabled = classifyExtractionError(new YoutubeTranscriptDisabledError(VIDEO_ID), false, 429);
  assert.equal(disabled.code, 'TRANSCRIPT_UNAVAILABLE');

  const tooManyRequests = classifyExtractionError(new YoutubeTranscriptTooManyRequestError(), false, 200);
  assert.equal(tooManyRequests.code, 'UPSTREAM_RATE_LIMITED');
  assert.equal(tooManyRequests.status, 429);
});

test('extraction wires per-request upstream-status tracking hooks into the transcript config', async () => {
  let capturedConfig: Record<string, unknown> | undefined;
  const handler = createVercelYouTubeTranscriptHandler({
    getSecret: () => TOKEN,
    transcriptFetch: async (_videoId, config) => {
      capturedConfig = config as unknown as Record<string, unknown>;
      return [{ text: 'cue', offset: 0, duration: 1, lang: 'en' }];
    },
    logger: { info() {}, error() {} },
  });
  const result = nodeResponse();

  await withoutHanging(handler(nodeRequest({ videoId: VIDEO_ID }, TOKEN), result.response));

  assert.equal(typeof capturedConfig?.videoFetch, 'function');
  assert.equal(typeof capturedConfig?.playerFetch, 'function');
  assert.equal(typeof capturedConfig?.transcriptFetch, 'function');
});

test('a failed extraction logs the observed upstream HTTP status for diagnosis', async () => {
  const errorLogs: Array<Record<string, unknown>> = [];
  const handler = createVercelYouTubeTranscriptHandler({
    getSecret: () => TOKEN,
    transcriptFetch: async () => {
      throw new YoutubeTranscriptVideoUnavailableError(VIDEO_ID);
    },
    logger: {
      info() {},
      error(event, metadata) {
        errorLogs.push({ event, ...(metadata as Record<string, unknown>) });
      },
    },
  });
  const result = nodeResponse();

  await withoutHanging(handler(nodeRequest({ videoId: VIDEO_ID }, TOKEN), result.response));

  const failureLog = errorLogs.find((entry) => entry.event === 'youtube_transcript_relay_failed');
  assert.ok(failureLog);
  assert.equal('upstreamStatus' in failureLog!, true);
});
