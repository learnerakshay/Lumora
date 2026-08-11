import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
  type TranscriptConfig,
  type TranscriptSegment,
} from 'youtube-transcript-plus';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const MAX_REQUEST_BYTES = 1_024;
const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
const MAX_CUES = 100_000;
const DEFAULT_EXTRACTION_TIMEOUT_MS = 20_000;

type RelayErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'UNAUTHORIZED'
  | 'RELAY_NOT_CONFIGURED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'REQUEST_TOO_LARGE'
  | 'MALFORMED_REQUEST'
  | 'INVALID_VIDEO_ID'
  | 'TRANSCRIPT_UNAVAILABLE'
  | 'EXTRACTION_TIMEOUT'
  | 'UPSTREAM_RATE_LIMITED'
  | 'UPSTREAM_BLOCKED'
  | 'MALFORMED_TRANSCRIPT_RESPONSE'
  | 'INTERNAL_ERROR';

class RelayFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: RelayErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RelayFailure';
  }
}

interface RelayDependencies {
  transcriptFetch?: (
    videoId: string,
    config: TranscriptConfig,
  ) => Promise<TranscriptSegment[]>;
  getSecret?: () => string | undefined;
  timeoutMs?: number;
  logger?: Pick<Console, 'info' | 'error'>;
}

interface NormalizedCue {
  text: string;
  offset: number;
  duration: number;
  lang: string;
}

type VercelRequest = IncomingMessage & { body?: unknown };

interface RelayRequestInput {
  method: string;
  authorization: string;
  contentType: string | undefined;
  readPayload: () => Promise<unknown>;
}

function requestHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseJsonPayload(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new RelayFailure(400, 'MALFORMED_REQUEST', 'Request body must be valid JSON.');
  }
}

function assertBodySize(rawBody: string | Buffer): void {
  if (Buffer.byteLength(rawBody) > MAX_REQUEST_BYTES) {
    throw new RelayFailure(413, 'REQUEST_TOO_LARGE', 'Request body exceeds the size limit.');
  }
}

async function readNodeRequestPayload(request: VercelRequest): Promise<unknown> {
  const declaredLength = Number(requestHeader(request, 'content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new RelayFailure(413, 'REQUEST_TOO_LARGE', 'Request body exceeds the size limit.');
  }

  if (request.body !== undefined) {
    if (typeof request.body === 'string') {
      assertBodySize(request.body);
      return parseJsonPayload(request.body);
    }
    if (Buffer.isBuffer(request.body)) {
      assertBodySize(request.body);
      return parseJsonPayload(request.body.toString('utf8'));
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(request.body);
    } catch {
      throw new RelayFailure(400, 'MALFORMED_REQUEST', 'Request body must be valid JSON.');
    }
    assertBodySize(serialized);
    return request.body;
  }

  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = MAX_REQUEST_BYTES + 1 - received;
    if (remaining > 0) chunks.push(buffer.subarray(0, remaining));
    received += buffer.byteLength;
    if (received > MAX_REQUEST_BYTES) {
      throw new RelayFailure(413, 'REQUEST_TOO_LARGE', 'Request body exceeds the size limit.');
    }
  }
  return parseJsonPayload(Buffer.concat(chunks).toString('utf8'));
}

async function sendWebResponse(response: Response, destination: ServerResponse): Promise<void> {
  destination.statusCode = response.status;
  response.headers.forEach((value, name) => destination.setHeader(name, value));
  destination.end(Buffer.from(await response.arrayBuffer()));
}

function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function secureEqual(actual: string, expected: string): boolean {
  const actualHash = createHash('sha256').update(actual).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

async function readBoundedBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new RelayFailure(413, 'REQUEST_TOO_LARGE', 'Request body exceeds the size limit.');
  }
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new RelayFailure(413, 'REQUEST_TOO_LARGE', 'Request body exceeds the size limit.');
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

function validateAndNormalizeTranscript(value: unknown): NormalizedCue[] {
  if (!Array.isArray(value) || value.length > MAX_CUES) {
    throw new RelayFailure(
      502,
      'MALFORMED_TRANSCRIPT_RESPONSE',
      'YouTube returned an invalid transcript response.',
    );
  }
  if (value.length === 0) {
    throw new RelayFailure(
      404,
      'TRANSCRIPT_UNAVAILABLE',
      'A transcript is not available for this video.',
    );
  }

  let transcriptBytes = 0;
  return value.map((cue, index) => {
    if (
      !cue ||
      typeof cue !== 'object' ||
      typeof (cue as TranscriptSegment).text !== 'string' ||
      !(cue as TranscriptSegment).text.trim() ||
      !Number.isFinite((cue as TranscriptSegment).offset) ||
      (cue as TranscriptSegment).offset < 0 ||
      !Number.isFinite((cue as TranscriptSegment).duration) ||
      (cue as TranscriptSegment).duration < 0 ||
      typeof (cue as TranscriptSegment).lang !== 'string' ||
      !(cue as TranscriptSegment).lang.trim()
    ) {
      throw new RelayFailure(
        502,
        'MALFORMED_TRANSCRIPT_RESPONSE',
        `YouTube returned an invalid transcript cue at index ${index}.`,
      );
    }

    const text = (cue as TranscriptSegment).text.trim();
    const lang = (cue as TranscriptSegment).lang.trim();
    transcriptBytes += Buffer.byteLength(text, 'utf8');
    if (transcriptBytes > MAX_TRANSCRIPT_BYTES) {
      throw new RelayFailure(
        502,
        'MALFORMED_TRANSCRIPT_RESPONSE',
        'YouTube returned an unexpectedly large transcript.',
      );
    }
    return {
      text,
      offset: (cue as TranscriptSegment).offset,
      duration: (cue as TranscriptSegment).duration,
      lang,
    };
  });
}

function classifyExtractionError(error: unknown, timedOut: boolean): RelayFailure {
  if (error instanceof RelayFailure) return error;
  if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
    return new RelayFailure(504, 'EXTRACTION_TIMEOUT', 'Transcript extraction timed out.', error);
  }
  if (
    error instanceof YoutubeTranscriptDisabledError ||
    error instanceof YoutubeTranscriptNotAvailableError ||
    error instanceof YoutubeTranscriptNotAvailableLanguageError ||
    error instanceof YoutubeTranscriptVideoUnavailableError
  ) {
    return new RelayFailure(
      404,
      'TRANSCRIPT_UNAVAILABLE',
      'A transcript is not available for this video.',
      error,
    );
  }
  if (error instanceof YoutubeTranscriptTooManyRequestError) {
    return new RelayFailure(429, 'UPSTREAM_RATE_LIMITED', 'YouTube rate-limited transcript extraction.', error);
  }

  const message = error instanceof Error ? error.message : '';
  if (/disabled|unavailable|no transcript|not available/i.test(message)) {
    return new RelayFailure(
      404,
      'TRANSCRIPT_UNAVAILABLE',
      'A transcript is not available for this video.',
      error,
    );
  }
  if (/\b429\b|too many requests|rate.?limit/i.test(message)) {
    return new RelayFailure(429, 'UPSTREAM_RATE_LIMITED', 'YouTube rate-limited transcript extraction.', error);
  }
  if (/\b403\b|forbidden|blocked|challenge|captcha/i.test(message)) {
    return new RelayFailure(503, 'UPSTREAM_BLOCKED', 'YouTube blocked transcript extraction.', error);
  }
  if (error instanceof SyntaxError || /malformed|invalid (?:json|xml)|parse error/i.test(message)) {
    return new RelayFailure(
      502,
      'MALFORMED_TRANSCRIPT_RESPONSE',
      'YouTube returned an invalid transcript response.',
      error,
    );
  }
  return new RelayFailure(500, 'INTERNAL_ERROR', 'Transcript extraction failed unexpectedly.', error);
}

function createYouTubeTranscriptProcessor(dependencies: RelayDependencies = {}) {
  const transcriptFetch = dependencies.transcriptFetch || fetchTranscript;
  const getSecret = dependencies.getSecret || (() => process.env.YOUTUBE_TRANSCRIPT_RELAY_TOKEN);
  const timeoutMs = dependencies.timeoutMs || DEFAULT_EXTRACTION_TIMEOUT_MS;
  const logger = dependencies.logger || console;

  return async function processYouTubeTranscript(input: RelayRequestInput): Promise<Response> {
    const startedAt = Date.now();
    let videoId: string | undefined;
    try {
      if (input.method !== 'POST') {
        throw new RelayFailure(405, 'METHOD_NOT_ALLOWED', 'Only POST requests are supported.');
      }

      const secret = getSecret()?.trim();
      if (!secret) {
        throw new RelayFailure(500, 'RELAY_NOT_CONFIGURED', 'Transcript relay is not configured.');
      }
      const authorization = input.authorization;
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (!token || !secureEqual(token, secret)) {
        throw new RelayFailure(401, 'UNAUTHORIZED', 'A valid bearer token is required.');
      }

      const contentType = input.contentType?.split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        throw new RelayFailure(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
      }
      const payload = await input.readPayload();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new RelayFailure(400, 'MALFORMED_REQUEST', 'Request body must be a JSON object.');
      }
      videoId = (payload as { videoId?: unknown }).videoId as string | undefined;
      if (typeof videoId !== 'string' || !VIDEO_ID_PATTERN.test(videoId)) {
        throw new RelayFailure(400, 'INVALID_VIDEO_ID', 'videoId must be a valid 11-character YouTube ID.');
      }

      const controller = new AbortController();
      let timedOut = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutFailure = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(new RelayFailure(504, 'EXTRACTION_TIMEOUT', 'Transcript extraction timed out.'));
          }, timeoutMs);
        });
        const transcript = await Promise.race([
          transcriptFetch(videoId, {
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
              'AppleWebKit/537.36 (KHTML, like Gecko) ' +
              'Chrome/124.0.0.0 Safari/537.36',
            retries: 1,
            retryDelay: 500,
            signal: controller.signal,
          }),
          timeoutFailure,
        ]);
        const cues = validateAndNormalizeTranscript(transcript);
        logger.info('youtube_transcript_relay_succeeded', {
          videoId,
          cueCount: cues.length,
          durationMs: Date.now() - startedAt,
        });
        return jsonResponse(200, { language: cues[0].lang, cues });
      } catch (error) {
        throw classifyExtractionError(error, timedOut);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    } catch (error) {
      const failure = error instanceof RelayFailure
        ? error
        : new RelayFailure(500, 'INTERNAL_ERROR', 'Transcript relay failed unexpectedly.', error);
      logger.error('youtube_transcript_relay_failed', {
        videoId,
        errorCode: failure.code,
        errorName: failure.cause instanceof Error ? failure.cause.name : undefined,
        durationMs: Date.now() - startedAt,
      });
      return jsonResponse(
        failure.status,
        { error: { code: failure.code, message: failure.message } },
        failure.status === 405 ? { Allow: 'POST' } : undefined,
      );
    }
  };
}

export function createYouTubeTranscriptRelay(dependencies: RelayDependencies = {}) {
  const processRequest = createYouTubeTranscriptProcessor(dependencies);
  return async function youtubeTranscriptRelay(request: Request): Promise<Response> {
    return processRequest({
      method: request.method,
      authorization: request.headers.get('authorization') || '',
      contentType: request.headers.get('content-type') || undefined,
      readPayload: async () => parseJsonPayload(await readBoundedBody(request)),
    });
  };
}

export function createVercelYouTubeTranscriptHandler(dependencies: RelayDependencies = {}) {
  const processRequest = createYouTubeTranscriptProcessor(dependencies);
  const logger = dependencies.logger || console;

  return async function vercelYouTubeTranscriptHandler(
    request: VercelRequest,
    response: ServerResponse,
  ): Promise<void> {
    let failureStep = 'READ_REQUEST';
    try {
      const input: RelayRequestInput = {
        method: request.method || 'GET',
        authorization: requestHeader(request, 'authorization') || '',
        contentType: requestHeader(request, 'content-type'),
        readPayload: () => readNodeRequestPayload(request),
      };
      failureStep = 'PROCESS_RELAY';
      const relayResponse = await processRequest(input);
      failureStep = 'WRITE_RESPONSE';
      await sendWebResponse(relayResponse, response);
    } catch (error) {
      logger.error('youtube_transcript_relay_adapter_failed', {
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : 'Unknown adapter failure',
        failureStep,
      });
      try {
        if (!response.headersSent) {
          await sendWebResponse(
            jsonResponse(500, {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Transcript relay failed unexpectedly.',
              },
            }),
            response,
          );
        }
      } catch (fallbackError) {
        logger.error('youtube_transcript_relay_adapter_failed', {
          errorName: fallbackError instanceof Error ? fallbackError.name : undefined,
          errorMessage: fallbackError instanceof Error
            ? fallbackError.message
            : 'Unknown adapter failure',
          failureStep: 'WRITE_ERROR_RESPONSE',
        });
      } finally {
        if (!response.writableEnded) {
          try {
            response.end();
          } catch (endError) {
            logger.error('youtube_transcript_relay_adapter_failed', {
              errorName: endError instanceof Error ? endError.name : undefined,
              errorMessage: endError instanceof Error ? endError.message : 'Unknown adapter failure',
              failureStep: 'END_RESPONSE',
            });
          }
        }
      }
    }
  };
}

export default createVercelYouTubeTranscriptHandler();
