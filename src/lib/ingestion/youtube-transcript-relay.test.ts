import assert from 'node:assert/strict';
import test from 'node:test';
import {
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  type TranscriptSegment,
} from 'youtube-transcript-plus';
import { createYouTubeTranscriptRelay } from '../../../api/youtube-transcript';
import { fetchYouTubeTranscript } from './youtube-transcript-provider';

const VIDEO_ID = 'dQw4w9WgXcQ';
const TOKEN = 'relay-test-secret';
const silentLogger = { info() {}, error() {} };

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
