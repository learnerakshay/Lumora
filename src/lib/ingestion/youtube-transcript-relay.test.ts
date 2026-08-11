import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { Readable } from 'node:stream';
import {
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  type TranscriptSegment,
} from 'youtube-transcript-plus';
import {
  createVercelYouTubeTranscriptHandler,
  createYouTubeTranscriptRelay,
} from '../../../api/youtube-transcript';
import { fetchYouTubeTranscript } from './youtube-transcript-provider';

const VIDEO_ID = 'dQw4w9WgXcQ';
const TOKEN = 'relay-test-secret';
const silentLogger = { info() {}, error() {} };

function nodeRequest(body: string, token?: string): IncomingMessage {
  const request = Readable.from([Buffer.from(body)]) as IncomingMessage;
  request.method = 'POST';
  request.url = '/api/youtube-transcript';
  request.headers = {
    host: 'lumora.example',
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(body)),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  return request;
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

function relayRequest(
  handler: (request: Request) => Promise<Response>,
  options: { token?: string; videoId?: unknown; body?: string } = {},
) {
  return handler(new Request('https://lumora.example/api/youtube-transcript', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ?? JSON.stringify({ videoId: options.videoId ?? VIDEO_ID }),
  }));
}

function testRelay(
  transcriptFetch: (videoId: string, config: Record<string, unknown>) => Promise<TranscriptSegment[]>,
  timeoutMs = 1_000,
) {
  return createYouTubeTranscriptRelay({
    getSecret: () => TOKEN,
    transcriptFetch,
    timeoutMs,
    logger: silentLogger,
  });
}

test('Vercel Node handler reaches extraction with the parsed videoId and ends the response', async () => {
  let receivedVideoId = '';
  const handler = createVercelYouTubeTranscriptHandler({
    getSecret: () => TOKEN,
    transcriptFetch: async (videoId) => {
      receivedVideoId = videoId;
      return [{ text: 'Node response', offset: 0, duration: 1, lang: 'en' }];
    },
    timeoutMs: 1_000,
    logger: silentLogger,
  });
  const result = nodeResponse();
  const request = nodeRequest('', TOKEN) as IncomingMessage & { body?: unknown };
  request.body = { videoId: VIDEO_ID };

  assert.equal(handler.length, 2);
  await withoutHanging(handler(request, result.response));
  await withoutHanging(result.completed);

  assert.equal(receivedVideoId, VIDEO_ID);
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.response.writableEnded, true);
  assert.deepEqual(JSON.parse(result.body()), {
    language: 'en',
    cues: [{ text: 'Node response', offset: 0, duration: 1, lang: 'en' }],
  });
});

test('Vercel Node handler returns unauthorized immediately without extraction', async () => {
  let called = false;
  const handler = createVercelYouTubeTranscriptHandler({
    getSecret: () => TOKEN,
    transcriptFetch: async () => {
      called = true;
      return [];
    },
    logger: silentLogger,
  });
  const result = nodeResponse();

  await withoutHanging(handler(nodeRequest(JSON.stringify({ videoId: VIDEO_ID })), result.response));

  assert.equal(result.response.statusCode, 401);
  assert.equal(result.response.writableEnded, true);
  assert.equal(called, false);
  assert.equal(JSON.parse(result.body()).error.code, 'UNAUTHORIZED');
});

test('Vercel Node handler returns malformed body immediately without extraction', async () => {
  let called = false;
  const handler = createVercelYouTubeTranscriptHandler({
    getSecret: () => TOKEN,
    transcriptFetch: async () => {
      called = true;
      return [];
    },
    logger: silentLogger,
  });
  const result = nodeResponse();

  await withoutHanging(handler(nodeRequest('{not-json', TOKEN), result.response));

  assert.equal(result.response.statusCode, 400);
  assert.equal(result.response.writableEnded, true);
  assert.equal(called, false);
  assert.equal(JSON.parse(result.body()).error.code, 'MALFORMED_REQUEST');
});

test('relay accepts an authenticated valid request and normalizes complete cues', async () => {
  let receivedVideoId = '';
  const handler = testRelay(async (videoId) => {
    receivedVideoId = videoId;
    return [{ text: '  Grounded cue  ', offset: 1.25, duration: 2.5, lang: 'en' }];
  });

  const response = await relayRequest(handler, { token: TOKEN });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(receivedVideoId, VIDEO_ID);
  assert.deepEqual(await response.json(), {
    language: 'en',
    cues: [{ text: 'Grounded cue', offset: 1.25, duration: 2.5, lang: 'en' }],
  });
});

test('relay rejects missing and incorrect bearer tokens', async () => {
  const handler = testRelay(async () => []);
  const missing = await relayRequest(handler);
  const wrong = await relayRequest(handler, { token: 'wrong-secret' });

  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal((await missing.json() as any).error.code, 'UNAUTHORIZED');
  assert.equal((await wrong.json() as any).error.code, 'UNAUTHORIZED');
});

test('relay rejects malformed video IDs before extraction', async () => {
  let called = false;
  const handler = testRelay(async () => {
    called = true;
    return [];
  });
  const response = await relayRequest(handler, { token: TOKEN, videoId: '../watch?v=bad' });

  assert.equal(response.status, 400);
  assert.equal((await response.json() as any).error.code, 'INVALID_VIDEO_ID');
  assert.equal(called, false);
});

test('relay classifies unavailable transcripts', async () => {
  const handler = testRelay(async () => {
    throw new YoutubeTranscriptNotAvailableError(VIDEO_ID);
  });
  const response = await relayRequest(handler, { token: TOKEN });

  assert.equal(response.status, 404);
  assert.equal((await response.json() as any).error.code, 'TRANSCRIPT_UNAVAILABLE');
});

test('relay enforces its timeout and classifies upstream rate limits', async () => {
  const timeoutHandler = testRelay(
    async () => new Promise<TranscriptSegment[]>(() => undefined),
    10,
  );
  const timedOut = await relayRequest(timeoutHandler, { token: TOKEN });
  assert.equal(timedOut.status, 504);
  assert.equal((await timedOut.json() as any).error.code, 'EXTRACTION_TIMEOUT');

  const rateLimitedHandler = testRelay(async () => {
    throw new YoutubeTranscriptTooManyRequestError();
  });
  const rateLimited = await relayRequest(rateLimitedHandler, { token: TOKEN });
  assert.equal(rateLimited.status, 429);
  assert.equal((await rateLimited.json() as any).error.code, 'UPSTREAM_RATE_LIMITED');
});

test('relay rejects empty, malformed, or incomplete transcript responses', async () => {
  const emptyHandler = testRelay(async () => []);
  const empty = await relayRequest(emptyHandler, { token: TOKEN });
  assert.equal(empty.status, 404);
  assert.equal((await empty.json() as any).error.code, 'TRANSCRIPT_UNAVAILABLE');

  const incompleteHandler = testRelay(async () => [
    { text: 'Missing language', offset: 0, duration: 1 } as TranscriptSegment,
  ]);
  const incomplete = await relayRequest(incompleteHandler, { token: TOKEN });
  assert.equal(incomplete.status, 502);
  assert.equal((await incomplete.json() as any).error.code, 'MALFORMED_TRANSCRIPT_RESPONSE');

  const malformedHandler = testRelay(async () => {
    throw new SyntaxError('Unexpected token while parsing upstream JSON');
  });
  const malformed = await relayRequest(malformedHandler, { token: TOKEN });
  assert.equal(malformed.status, 502);
  assert.equal((await malformed.json() as any).error.code, 'MALFORMED_TRANSCRIPT_RESPONSE');
});

test('existing Render proxy adapter consumes relay output and revalidates cues', async () => {
  const handler = testRelay(async () => [
    { text: 'Relay contract', offset: 0, duration: 1.5, lang: 'en' },
  ]);
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
      fetchImpl: async (input, init) => handler(new Request(input, init)),
    },
  );

  assert.equal(result.provider, 'proxy');
  assert.equal(result.language, 'en');
  assert.deepEqual(result.cues, [
    { text: 'Relay contract', offset: 0, duration: 1.5, lang: 'en' },
  ]);
});
