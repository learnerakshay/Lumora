import { ApiError, GoogleGenAI } from '@google/genai';
import { logger as defaultLogger } from '../logger';

export const GEMINI_YOUTUBE_MODEL = 'gemini-3.6-flash';
export const GEMINI_YOUTUBE_TIMEOUT_MS = 120_000;
export const GEMINI_YOUTUBE_TOTAL_TIMEOUT_MS = 180_000;

const RETRY_BACKOFF_MS = 500;
const MAX_PRIMARY_ATTEMPTS = 2;

export type GeminiYouTubeFailureClassification =
  | 'VIDEO_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'EXTRACTION_MALFORMED'
  | 'NO_SPEECH_DETECTED'
  | 'CONTENT_POLICY'
  | 'UPSTREAM_FAILURE';

export interface GeminiYouTubeSegment {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface GeminiYouTubeAcquisitionResult {
  language: string;
  segments: GeminiYouTubeSegment[];
}

export class GeminiYouTubeAcquisitionError extends Error {
  constructor(
    readonly classification: GeminiYouTubeFailureClassification,
    message: string,
    readonly retryable: boolean,
    readonly cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'GeminiYouTubeAcquisitionError';
  }
}

interface InteractionResponse {
  output_text?: string;
}

interface GeminiYouTubeDependencies {
  createInteraction?: (
    request: Record<string, unknown>,
    options: {
      timeout: number;
      maxRetries: number;
      fetchOptions: { signal: AbortSignal };
    },
  ) => Promise<InteractionResponse>;
  logger?: Pick<typeof defaultLogger, 'info' | 'error'>;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  retryBackoffMs?: number;
}

const TRANSCRIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['language', 'segments'],
  properties: {
    language: {
      type: 'string',
      minLength: 2,
      description: 'Primary spoken language, using ISO 639-1 when possible.',
    },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'startSeconds', 'endSeconds'],
        properties: {
          text: { type: 'string', minLength: 1 },
          startSeconds: { type: 'number', minimum: 0 },
          endSeconds: { type: 'number', minimum: 0 },
        },
      },
    },
  },
} as const;

const TRANSCRIPT_PROMPT = [
  'Create a faithful, complete transcript of all discernible spoken content in this video.',
  'Preserve the original spoken language and do not summarize, paraphrase, or omit speech.',
  'Return ordered timestamped segments with accurate startSeconds and endSeconds.',
  'Use the ISO 639-1 primary language code when possible.',
  'Return an empty segments array only when no speech is discernible.',
  'Output nothing outside the required JSON schema.',
].join(' ');

const NO_SPEECH_VERIFICATION_PROMPT = [
  'Perform a second, complete verification pass over this video for human speech.',
  'Listen for brief, quiet, background, voice-over, or dialogue speech that may have been missed previously.',
  'If any speech is discernible, return a faithful transcript with ordered startSeconds and endSeconds segments.',
  'Return an empty segments array only after reviewing the complete video and confirming there is no discernible speech.',
  'Preserve the original spoken language, use an ISO 639-1 language code when possible, and output nothing outside the required JSON schema.',
].join(' ');

function statusOf(error: unknown): number | undefined {
  const status = error instanceof ApiError
    ? error.status
    : (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function classifyProviderError(error: unknown): GeminiYouTubeAcquisitionError {
  if (error instanceof GeminiYouTubeAcquisitionError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new GeminiYouTubeAcquisitionError(
      'TIMEOUT',
      'Gemini YouTube acquisition timed out.',
      true,
      error,
    );
  }

  const status = statusOf(error);
  const message = messageOf(error);
  if (status === 429) {
    return new GeminiYouTubeAcquisitionError(
      'RATE_LIMITED',
      'Gemini rate-limited YouTube acquisition.',
      true,
      error,
    );
  }
  if (/policy|safety|blocked|prohibited|copyright/i.test(message)) {
    return new GeminiYouTubeAcquisitionError(
      'CONTENT_POLICY',
      'Gemini could not process this video because of a content policy restriction.',
      false,
      error,
    );
  }
  if (
    status === 404 ||
    /private video|video (?:is )?unavailable|not found|cannot access (?:the )?video/i.test(message)
  ) {
    return new GeminiYouTubeAcquisitionError(
      'VIDEO_UNAVAILABLE',
      'The public YouTube video is unavailable to Gemini.',
      false,
      error,
    );
  }
  if (status !== undefined && status >= 500) {
    return new GeminiYouTubeAcquisitionError(
      'UPSTREAM_FAILURE',
      'Gemini temporarily failed to process the YouTube video.',
      true,
      error,
    );
  }
  if (
    error instanceof TypeError ||
    /network|fetch failed|socket|connection reset|econnreset|etimedout/i.test(message)
  ) {
    return new GeminiYouTubeAcquisitionError(
      'UPSTREAM_FAILURE',
      'Gemini could not be reached while processing the YouTube video.',
      true,
      error,
    );
  }
  return new GeminiYouTubeAcquisitionError(
    'UPSTREAM_FAILURE',
    'Gemini failed to process the YouTube video.',
    false,
    error,
  );
}

function parseAndValidateOutput(outputText: string | undefined): GeminiYouTubeAcquisitionResult {
  if (typeof outputText !== 'string' || !outputText.trim()) {
    throw new GeminiYouTubeAcquisitionError(
      'EXTRACTION_MALFORMED',
      'Gemini returned no structured transcript output.',
      true,
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(outputText);
  } catch (error) {
    throw new GeminiYouTubeAcquisitionError(
      'EXTRACTION_MALFORMED',
      'Gemini returned invalid transcript JSON.',
      true,
      error,
    );
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GeminiYouTubeAcquisitionError(
      'EXTRACTION_MALFORMED',
      'Gemini returned an invalid transcript structure.',
      true,
    );
  }

  const rootKeys = Object.keys(value);
  if (rootKeys.length !== 2 || !rootKeys.includes('language') || !rootKeys.includes('segments')) {
    throw new GeminiYouTubeAcquisitionError(
      'EXTRACTION_MALFORMED',
      'Gemini returned an invalid transcript structure.',
      true,
    );
  }

  const language = (value as { language?: unknown }).language;
  const segments = (value as { segments?: unknown }).segments;
  if (
    typeof language !== 'string' ||
    !/^(?:[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*|und)$/.test(language.trim()) ||
    !Array.isArray(segments)
  ) {
    throw new GeminiYouTubeAcquisitionError(
      'EXTRACTION_MALFORMED',
      'Gemini returned an invalid transcript structure.',
      true,
    );
  }
  if (segments.length === 0) {
    throw new GeminiYouTubeAcquisitionError(
      'NO_SPEECH_DETECTED',
      'Gemini detected no discernible speech in this video.',
      false,
    );
  }

  let previousStart = -1;
  const validated = segments.map((segment, index) => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
      throw new GeminiYouTubeAcquisitionError(
        'EXTRACTION_MALFORMED',
        `Gemini returned an invalid transcript segment at index ${index}.`,
        true,
      );
    }
    const segmentKeys = Object.keys(segment);
    if (
      segmentKeys.length !== 3 ||
      !segmentKeys.includes('text') ||
      !segmentKeys.includes('startSeconds') ||
      !segmentKeys.includes('endSeconds')
    ) {
      throw new GeminiYouTubeAcquisitionError(
        'EXTRACTION_MALFORMED',
        `Gemini returned an invalid transcript segment at index ${index}.`,
        true,
      );
    }
    const { text, startSeconds, endSeconds } = segment as {
      text?: unknown;
      startSeconds?: unknown;
      endSeconds?: unknown;
    };
    if (
      typeof text !== 'string' ||
      !text.trim() ||
      typeof startSeconds !== 'number' ||
      !Number.isFinite(startSeconds) ||
      startSeconds < 0 ||
      typeof endSeconds !== 'number' ||
      !Number.isFinite(endSeconds) ||
      endSeconds < startSeconds ||
      startSeconds < previousStart
    ) {
      throw new GeminiYouTubeAcquisitionError(
        'EXTRACTION_MALFORMED',
        `Gemini returned an invalid transcript segment at index ${index}.`,
        true,
      );
    }
    previousStart = startSeconds;
    return { text: text.trim(), startSeconds, endSeconds };
  });
  return { language: language.trim(), segments: validated };
}

export async function acquireGeminiYouTubeTranscript(input: {
  apiKey: string;
  videoId: string;
  youtubeUrl: string;
}, dependencies: GeminiYouTubeDependencies = {}): Promise<GeminiYouTubeAcquisitionResult> {
  const timeoutMs = dependencies.timeoutMs ?? GEMINI_YOUTUBE_TIMEOUT_MS;
  const totalTimeoutMs = dependencies.totalTimeoutMs ?? GEMINI_YOUTUBE_TOTAL_TIMEOUT_MS;
  const retryBackoffMs = dependencies.retryBackoffMs ?? RETRY_BACKOFF_MS;
  const log = dependencies.logger ?? defaultLogger;
  const client = dependencies.createInteraction
    ? null
    : new GoogleGenAI({ apiKey: input.apiKey });
  const createInteraction = dependencies.createInteraction
    ?? ((request, options) => client!.interactions.create(request as any, options));
  let verifyingNoSpeech = false;
  let verificationAttempted = false;
  let primarySegmentCount: number | null = null;
  let verificationSegmentCount: number | null = null;
  const acquisitionStartedAt = Date.now();

  const logFinalClassification = (
    finalClassification: 'SUCCESS' | GeminiYouTubeFailureClassification,
    retryable: boolean,
  ) => {
    log.info('YOUTUBE_FINAL_ACQUISITION_CLASSIFICATION', {
      videoId: input.videoId,
      recoveredFromPrimaryEmpty:
        verificationAttempted &&
        finalClassification === 'SUCCESS' &&
        (verificationSegmentCount || 0) > 0,
      primarySegmentCount,
      verificationAttempted,
      verificationSegmentCount,
      finalClassification,
      retryable,
    });
  };

  for (let attempt = 1; attempt <= MAX_PRIMARY_ATTEMPTS + 1; attempt += 1) {
    const startedAt = Date.now();
    const remainingBudgetMs = totalTimeoutMs - (startedAt - acquisitionStartedAt);
    if (remainingBudgetMs <= 0) {
      const failure = new GeminiYouTubeAcquisitionError(
        'TIMEOUT',
        'Gemini YouTube acquisition exceeded its total latency budget.',
        true,
      );
      logFinalClassification(failure.classification, failure.retryable);
      throw failure;
    }
    const attemptTimeoutMs = Math.min(timeoutMs, remainingBudgetMs);
    if (verifyingNoSpeech) {
      log.info('YOUTUBE_NO_SPEECH_VERIFICATION_STARTED', {
        videoId: input.videoId,
      });
    } else {
      log.info('YOUTUBE_PRIMARY_ACQUISITION_STARTED', {
        videoId: input.videoId,
      });
    }
    log.info('Gemini YouTube acquisition started', {
      videoId: input.videoId,
      model: GEMINI_YOUTUBE_MODEL,
      stage: 'ACQUISITION_START',
      attempt,
      acquisitionMode: verifyingNoSpeech ? 'no_speech_verification' : 'primary',
    });
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutFailure = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          const error = new Error('Gemini YouTube acquisition timed out.');
          error.name = 'AbortError';
          reject(error);
        }, attemptTimeoutMs);
      });
      const interaction = await Promise.race([
        createInteraction({
          model: GEMINI_YOUTUBE_MODEL,
          input: [
            { type: 'video', uri: input.youtubeUrl },
            {
              type: 'text',
              text: verifyingNoSpeech
                ? NO_SPEECH_VERIFICATION_PROMPT
                : TRANSCRIPT_PROMPT,
            },
          ],
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: TRANSCRIPT_SCHEMA,
          },
        }, {
          timeout: attemptTimeoutMs,
          maxRetries: 0,
          fetchOptions: { signal: controller.signal },
        }),
        timeoutFailure,
      ]);
      const outputParsingStartedAt = Date.now();
      const result = parseAndValidateOutput(interaction.output_text);
      const outputParsingDurationMs = Date.now() - outputParsingStartedAt;
      if (verifyingNoSpeech) {
        verificationSegmentCount = result.segments.length;
        log.info('YOUTUBE_NO_SPEECH_VERIFICATION_RESULT', {
          videoId: input.videoId,
          segmentCount: verificationSegmentCount,
          durationMs: Date.now() - startedAt,
          providerResult: 'SUCCESS',
          classification: 'SUCCESS',
        });
      } else {
        primarySegmentCount = result.segments.length;
        log.info('YOUTUBE_PRIMARY_ACQUISITION_RESULT', {
          videoId: input.videoId,
          segmentCount: primarySegmentCount,
          durationMs: Date.now() - startedAt,
          classification: 'SUCCESS',
        });
      }
      log.info('Gemini YouTube acquisition succeeded', {
        videoId: input.videoId,
        model: GEMINI_YOUTUBE_MODEL,
        stage: 'ACQUISITION_SUCCESS',
        durationMs: Date.now() - startedAt,
        outputParsingDurationMs,
        segmentCount: result.segments.length,
        language: result.language,
      });
      logFinalClassification('SUCCESS', false);
      return result;
    } catch (error) {
      const failure = classifyProviderError(error);
      const segmentCount = failure.classification === 'NO_SPEECH_DETECTED'
        ? 0
        : null;
      if (verifyingNoSpeech) {
        verificationSegmentCount = segmentCount;
        log.info('YOUTUBE_NO_SPEECH_VERIFICATION_RESULT', {
          videoId: input.videoId,
          segmentCount: verificationSegmentCount,
          durationMs: Date.now() - startedAt,
          providerResult: 'ERROR',
          classification: failure.classification,
        });
      } else {
        primarySegmentCount = segmentCount;
        log.info('YOUTUBE_PRIMARY_ACQUISITION_RESULT', {
          videoId: input.videoId,
          segmentCount: primarySegmentCount,
          durationMs: Date.now() - startedAt,
          classification: failure.classification,
        });
      }
      log.error('Gemini YouTube acquisition failed', undefined, {
        videoId: input.videoId,
        model: GEMINI_YOUTUBE_MODEL,
        stage: 'ACQUISITION_FAILED',
        durationMs: Date.now() - startedAt,
        failureClassification: failure.classification,
        attempt,
        acquisitionMode: verifyingNoSpeech ? 'no_speech_verification' : 'primary',
      });
      if (
        failure.classification === 'NO_SPEECH_DETECTED' &&
        !verifyingNoSpeech
      ) {
        verificationAttempted = true;
        verifyingNoSpeech = true;
        continue;
      }
      if (
        verifyingNoSpeech ||
        !failure.retryable ||
        attempt === MAX_PRIMARY_ATTEMPTS
      ) {
        logFinalClassification(failure.classification, failure.retryable);
        throw failure;
      }
      const remainingAfterAttemptMs = totalTimeoutMs - (Date.now() - acquisitionStartedAt);
      if (remainingAfterAttemptMs <= 0) {
        logFinalClassification('TIMEOUT', true);
        throw new GeminiYouTubeAcquisitionError(
          'TIMEOUT',
          'Gemini YouTube acquisition exceeded its total latency budget.',
          true,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(retryBackoffMs, remainingAfterAttemptMs)),
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw new GeminiYouTubeAcquisitionError(
    'UPSTREAM_FAILURE',
    'Gemini YouTube acquisition exhausted all attempts.',
    false,
  );
}
