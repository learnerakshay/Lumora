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

function requestHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function secureEqual(actual: string, expected: string): boolean {
  const actualHash = createHash('sha256').update(actual).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  if (response.writableEnded) return;
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
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
    return new RelayFailure(
      429,
      'UPSTREAM_RATE_LIMITED',
      'YouTube rate-limited transcript extraction.',
      error,
    );
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
    return new RelayFailure(
      429,
      'UPSTREAM_RATE_LIMITED',
      'YouTube rate-limited transcript extraction.',
      error,
    );
  }
  if (/\b403\b|forbidden|blocked|challenge|captcha/i.test(message)) {
    return new RelayFailure(
      503,
      'UPSTREAM_BLOCKED',
      'YouTube blocked transcript extraction.',
      error,
    );
  }
  if (error instanceof SyntaxError || /malformed|invalid (?:json|xml)|parse error/i.test(message)) {
    return new RelayFailure(
      502,
      'MALFORMED_TRANSCRIPT_RESPONSE',
      'YouTube returned an invalid transcript response.',
      error,
    );
  }
  return new RelayFailure(
    500,
    'INTERNAL_ERROR',
    'Transcript extraction failed unexpectedly.',
    error,
  );
}

export function createVercelYouTubeTranscriptHandler(dependencies: RelayDependencies = {}) {
  const transcriptFetch = dependencies.transcriptFetch || fetchTranscript;
  const getSecret = dependencies.getSecret || (() => process.env.YOUTUBE_TRANSCRIPT_RELAY_TOKEN);
  const timeoutMs = dependencies.timeoutMs || DEFAULT_EXTRACTION_TIMEOUT_MS;
  const logger = dependencies.logger || console;

  return async function youtubeTranscriptHandler(
    request: VercelRequest,
    response: ServerResponse,
  ): Promise<void> {
    const startedAt = Date.now();
    let videoId: string | undefined;
    let failureStage = 'REQUEST';

    try {
      if (request.method !== 'POST') {
        throw new RelayFailure(405, 'METHOD_NOT_ALLOWED', 'Only POST requests are supported.');
      }

      const secret = getSecret()?.trim();
      if (!secret) {
        throw new RelayFailure(500, 'RELAY_NOT_CONFIGURED', 'Transcript relay is not configured.');
      }
      const authorization = requestHeader(request, 'authorization') || '';
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (!token || !secureEqual(token, secret)) {
        throw new RelayFailure(401, 'UNAUTHORIZED', 'A valid bearer token is required.');
      }

      const contentType = requestHeader(request, 'content-type')
        ?.split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (contentType !== 'application/json') {
        throw new RelayFailure(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
      }
      const declaredLength = Number(requestHeader(request, 'content-length') || '0');
      if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
        throw new RelayFailure(413, 'REQUEST_TOO_LARGE', 'Request body exceeds the size limit.');
      }

      const body = request.body;
      const bodyIsObject = Boolean(body) && typeof body === 'object' && !Array.isArray(body);
      const candidateVideoId = bodyIsObject
        ? (body as { videoId?: unknown }).videoId
        : undefined;
      logger.info('youtube_transcript_relay_request', {
        bodyPresent: body !== undefined && body !== null,
        bodyType: Array.isArray(body) ? 'array' : typeof body,
        videoIdPresent: typeof candidateVideoId === 'string',
      });

      if (!bodyIsObject) {
        throw new RelayFailure(400, 'MALFORMED_REQUEST', 'Request body must be a JSON object.');
      }
      if (typeof candidateVideoId !== 'string' || !VIDEO_ID_PATTERN.test(candidateVideoId)) {
        throw new RelayFailure(
          400,
          'INVALID_VIDEO_ID',
          'videoId must be a valid 11-character YouTube ID.',
        );
      }
      videoId = candidateVideoId;

      failureStage = 'EXTRACTION';
      const controller = new AbortController();
      let timedOut = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let transcript: TranscriptSegment[];
      try {
        const timeoutFailure = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(new RelayFailure(504, 'EXTRACTION_TIMEOUT', 'Transcript extraction timed out.'));
          }, timeoutMs);
        });
        transcript = await Promise.race([
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
      } catch (error) {
        throw classifyExtractionError(error, timedOut);
      } finally {
        if (timeout) clearTimeout(timeout);
      }

      failureStage = 'NORMALIZATION';
      const cues = validateAndNormalizeTranscript(transcript);
      logger.info('youtube_transcript_relay_succeeded', {
        videoId,
        cueCount: cues.length,
        durationMs: Date.now() - startedAt,
      });
      failureStage = 'RESPONSE';
      sendJson(response, 200, { language: cues[0].lang, cues });
    } catch (error) {
      const failure = error instanceof RelayFailure
        ? error
        : new RelayFailure(500, 'INTERNAL_ERROR', 'Transcript relay failed unexpectedly.', error);
      logger.error('youtube_transcript_relay_failed', {
        videoId,
        errorCode: failure.code,
        errorName: failure.cause instanceof Error ? failure.cause.name : failure.name,
        errorMessage: failure.cause instanceof Error ? failure.cause.message : failure.message,
        failureStage,
        durationMs: Date.now() - startedAt,
      });
      try {
        sendJson(
          response,
          failure.status,
          { error: { code: failure.code, message: failure.message } },
          failure.status === 405 ? { Allow: 'POST' } : {},
        );
      } catch (responseError) {
        logger.error('youtube_transcript_relay_response_failed', {
          errorName: responseError instanceof Error ? responseError.name : undefined,
          errorMessage: responseError instanceof Error ? responseError.message : 'Unknown response failure',
        });
      } finally {
        if (!response.writableEnded) response.end();
      }
    }
  };
}

export default createVercelYouTubeTranscriptHandler();
