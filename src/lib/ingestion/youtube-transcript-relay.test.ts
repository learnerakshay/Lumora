import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import type { TranscriptSegment } from 'youtube-transcript-plus';
import { createVercelYouTubeTranscriptHandler } from '../../../api/youtube-transcript';
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
    cues: [{ text: 'Production cue', offset: 1.25, duration: 2.5, lang: 'en' }],
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
    { text: 'Relay contract', offset: 0, duration: 1.5, lang: 'en' },
  ]);
});
