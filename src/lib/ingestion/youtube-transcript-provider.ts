import { getServerEnv } from '../env';
import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from 'youtube-transcript';
import { logger } from '../logger';
import { IngestionFailure } from './errors';
import {
  acquireGeminiYouTubeTranscript,
  GeminiYouTubeAcquisitionError,
} from './gemini-youtube-acquisition';
import { validatePublicHttpsUrl } from './safe-fetch';

const MAX_PROXY_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_PROXY_ATTEMPTS = 3;

export interface YouTubeTranscriptCue {
  text: string;
  offset: number;
  duration: number;
  lang?: string;
}

export interface YouTubeTranscriptResult {
  provider: 'direct' | 'proxy' | 'gemini';
  strategy: 'transcript_fast_path' | 'gemini_native';
  acquisitionDurationMs: number;
  language: string | null;
  cues: YouTubeTranscriptCue[];
}

export interface YouTubeTranscriptProviderConfig {
  provider: 'direct' | 'proxy';
  timeoutMs: number;
  proxyUrl?: string;
  proxyToken?: string;
  maxAttempts?: number;
}

export interface YouTubeTranscriptProviderDependencies {
  fetchImpl?: typeof fetch;
  validateEndpoint?: typeof validatePublicHttpsUrl;
  directFetch?: (videoId: string) => Promise<YouTubeTranscriptCue[]>;
  geminiAcquire?: typeof acquireGeminiYouTubeTranscript;
  runtimeConfig?: {
    geminiApiKey?: string;
    fastPath?: YouTubeTranscriptProviderConfig;
  };
  logger?: Pick<typeof logger, 'info'>;
}

function transcriptTextLength(cues: YouTubeTranscriptCue[]): number {
  return cues.reduce((total, cue) => total + cue.text.length, 0);
}

async function fetchGeminiTranscript(
  videoId: string,
  apiKey: string | undefined,
  dependencies: YouTubeTranscriptProviderDependencies,
): Promise<YouTubeTranscriptResult> {
  const startedAt = Date.now();
  if (!apiKey) {
    throw new IngestionFailure({
      message: 'GEMINI_API_KEY is not configured for YouTube acquisition',
      errorCode: 'PROVIDER_CONFIGURATION_ERROR',
      userMessage: 'YouTube ingestion is temporarily unavailable.',
      provider: 'gemini',
    });
  }

  try {
    const acquisition = await (dependencies.geminiAcquire || acquireGeminiYouTubeTranscript)({
      apiKey,
      videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });
    return {
      provider: 'gemini',
      strategy: 'gemini_native',
      acquisitionDurationMs: Date.now() - startedAt,
      language: acquisition.language,
      cues: acquisition.segments.map((segment) => ({
        text: segment.text,
        offset: segment.startSeconds * 1_000,
        duration: (segment.endSeconds - segment.startSeconds) * 1_000,
        lang: acquisition.language,
      })),
    };
  } catch (error) {
    if (!(error instanceof GeminiYouTubeAcquisitionError)) throw error;
    if (
      error.classification === 'VIDEO_UNAVAILABLE' ||
      error.classification === 'NO_SPEECH_DETECTED'
    ) {
      throw new IngestionFailure({
        message: `Gemini YouTube acquisition failed: ${error.classification}`,
        errorCode: error.classification,
        userMessage: error.classification === 'NO_SPEECH_DETECTED'
          ? 'No usable spoken content was detected in this video.'
          : 'This video could not be accessed.',
        provider: 'gemini',
        cause: error,
      });
    }

    const errorCode = error.classification === 'TIMEOUT'
      ? 'PROVIDER_TIMEOUT'
      : error.classification === 'EXTRACTION_MALFORMED'
        ? 'PROVIDER_MALFORMED_RESPONSE'
        : error.classification === 'CONTENT_POLICY'
          ? 'ACCESS_RESTRICTED'
          : 'PROVIDER_TEMPORARY_FAILURE';
    const userMessage = error.classification === 'CONTENT_POLICY'
      ? 'This YouTube video cannot be processed because access is restricted.'
      : error.classification === 'EXTRACTION_MALFORMED'
        ? 'We could not finish processing this video because the extraction was incomplete. Please try again shortly.'
        : 'We could not finish processing this video right now. Please try again shortly.';
    throw new IngestionFailure({
      message: `Gemini YouTube acquisition failed: ${error.classification}`,
      errorCode,
      userMessage,
      retryable: error.retryable,
      provider: 'gemini',
      cause: error,
    });
  }
}

function validateCues(value: unknown, provider: 'direct' | 'proxy'): YouTubeTranscriptCue[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new IngestionFailure({
      message: `${provider} transcript provider returned no cues`,
      errorCode: 'TRANSCRIPT_UNAVAILABLE',
      userMessage: 'A transcript is not available for this YouTube video.',
      provider,
    });
  }

  let previousOffset = -1;
  const cues = value.map((cue, index) => {
    if (
      !cue ||
      typeof cue !== 'object' ||
      typeof (cue as any).text !== 'string' ||
      !(cue as any).text.trim() ||
      !Number.isFinite((cue as any).offset) ||
      (cue as any).offset < 0 ||
      (cue as any).offset < previousOffset ||
      !Number.isFinite((cue as any).duration) ||
      (cue as any).duration < 0
    ) {
      throw new IngestionFailure({
        message: `${provider} transcript provider returned an invalid cue at index ${index}`,
        errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
        userMessage: 'The transcript provider returned incomplete transcript data.',
        retryable: true,
        provider,
      });
    }
    previousOffset = (cue as any).offset;
    return {
      text: (cue as any).text,
      offset: (cue as any).offset,
      duration: (cue as any).duration,
      ...(typeof (cue as any).lang === 'string' ? { lang: (cue as any).lang } : {}),
    };
  });

  return cues;
}

async function fetchDirectTranscript(
  videoId: string,
  config: YouTubeTranscriptProviderConfig,
  dependencies: YouTubeTranscriptProviderDependencies,
): Promise<YouTubeTranscriptResult> {
  const startedAt = Date.now();
  const directFetch = dependencies.directFetch || YoutubeTranscript.fetchTranscript.bind(YoutubeTranscript);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const fetchStartedAt = Date.now();
    logger.info('YouTube transcript extraction diagnostic', {
      videoId,
      stage: 'TRANSCRIPT_FETCH_START',
      timestamp: new Date(fetchStartedAt).toISOString(),
    });
    const timeoutFailure = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        const error = new Error('Reference YouTube transcript extraction timed out');
        error.name = 'AbortError';
        reject(error);
      }, config.timeoutMs);
    });
    let cues: YouTubeTranscriptCue[];
    try {
      cues = await Promise.race([directFetch(videoId), timeoutFailure]);
      logger.info('YouTube transcript extraction diagnostic', {
        videoId,
        stage: 'TRANSCRIPT_FETCH_SUCCESS',
        segmentCount: cues.length,
        durationMs: Date.now() - fetchStartedAt,
      });
    } catch (error: any) {
      logger.error('YouTube transcript extraction diagnostic', undefined, {
        videoId,
        stage: 'TRANSCRIPT_FETCH_FAILED',
        errorConstructorName: error?.constructor?.name || typeof error,
        errorName: error?.name || null,
        errorMessage: error?.message || String(error),
        durationMs: Date.now() - fetchStartedAt,
      });
      throw error;
    }
    const validated = validateCues(cues, 'direct');
    return {
      provider: 'direct',
      strategy: 'transcript_fast_path',
      acquisitionDurationMs: Date.now() - startedAt,
      language: validated.find((cue) => cue.lang)?.lang || null,
      cues: validated,
    };
  } catch (error: any) {
    if (error instanceof IngestionFailure) throw error;
    if (error?.name === 'AbortError') {
      throw new IngestionFailure({
        message: 'Direct YouTube transcript provider timed out',
        errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
        userMessage: 'The transcript provider timed out. Please retry shortly.',
        retryable: true,
        provider: 'direct',
        cause: error,
      });
    }
    if (
      error instanceof YoutubeTranscriptDisabledError ||
      error instanceof YoutubeTranscriptNotAvailableError ||
      error instanceof YoutubeTranscriptNotAvailableLanguageError ||
      error instanceof YoutubeTranscriptVideoUnavailableError ||
      /disabled|unavailable|no transcript|not available/i.test(error?.message || '')
    ) {
      throw new IngestionFailure({
        message: `Direct YouTube transcript is unavailable: ${error?.message || 'unavailable'}`,
        errorCode: 'TRANSCRIPT_UNAVAILABLE',
        userMessage: 'A transcript is not available for this YouTube video.',
        provider: 'direct',
        cause: error,
      });
    }
    if (error instanceof YoutubeTranscriptTooManyRequestError) {
      throw new IngestionFailure({
        message: 'Direct YouTube transcript provider was rate limited',
        errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
        userMessage: 'YouTube temporarily blocked transcript requests. Please retry shortly.',
        retryable: true,
        provider: 'direct',
        cause: error,
      });
    }
    throw new IngestionFailure({
      message: `Direct YouTube transcript provider failed: ${error?.message || 'unknown error'}`,
      errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
      userMessage: 'The transcript provider could not be reached. Please retry shortly.',
      retryable: true,
      provider: 'direct',
      cause: error,
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function retryableProviderStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function fetchProxyTranscript(
  videoId: string,
  config: YouTubeTranscriptProviderConfig,
  dependencies: YouTubeTranscriptProviderDependencies,
): Promise<YouTubeTranscriptResult> {
  if (!config.proxyUrl || !config.proxyToken) {
    throw new IngestionFailure({
      message: 'YouTube transcript proxy configuration is incomplete',
      errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
      userMessage: 'YouTube ingestion is temporarily unavailable.',
      retryable: true,
      provider: 'proxy',
    });
  }

  let endpoint: URL;
  try {
    endpoint = await (dependencies.validateEndpoint || validatePublicHttpsUrl)(
      config.proxyUrl,
    );
  } catch (error) {
    throw new IngestionFailure({
      message: 'YouTube transcript proxy endpoint is invalid or unreachable',
      errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
      userMessage: 'YouTube ingestion is temporarily unavailable.',
      retryable: true,
      provider: 'proxy',
      cause: error,
    });
  }
  const fetchImpl = dependencies.fetchImpl || fetch;
  const maximumAttempts = config.maxAttempts ?? MAX_PROXY_ATTEMPTS;
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.proxyToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ videoId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (attempt < maximumAttempts && retryableProviderStatus(response.status)) {
          await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
          continue;
        }
        const unavailable = response.status === 404 || response.status === 422;
        throw new IngestionFailure({
          message: `YouTube transcript proxy returned HTTP ${response.status}`,
          errorCode: unavailable ? 'TRANSCRIPT_UNAVAILABLE' : 'TRANSCRIPT_PROVIDER_ERROR',
          userMessage: unavailable
            ? 'A transcript is not available for this YouTube video.'
            : 'The transcript provider could not process this video. Please retry shortly.',
          retryable: !unavailable && retryableProviderStatus(response.status),
          provider: 'proxy',
          httpStatus: response.status,
        });
      }

      const declaredLength = Number(response.headers.get('content-length') || '0');
      if (declaredLength > MAX_PROXY_RESPONSE_BYTES) {
        throw new IngestionFailure({
          message: 'YouTube transcript proxy response exceeded the size limit',
          errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
          userMessage: 'The transcript provider returned an unexpectedly large response.',
          provider: 'proxy',
        });
      }
      const body = await response.text();
      if (Buffer.byteLength(body, 'utf8') > MAX_PROXY_RESPONSE_BYTES) {
        throw new IngestionFailure({
          message: 'YouTube transcript proxy response exceeded the size limit',
          errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
          userMessage: 'The transcript provider returned an unexpectedly large response.',
          provider: 'proxy',
        });
      }
      let payload: any;
      try {
        payload = JSON.parse(body);
      } catch (error) {
        throw new IngestionFailure({
          message: 'YouTube transcript proxy returned invalid JSON',
          errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
          userMessage: 'The transcript provider returned an invalid response.',
          retryable: true,
          provider: 'proxy',
          cause: error,
        });
      }
      const cues = validateCues(payload?.cues, 'proxy');
      return {
        provider: 'proxy',
        strategy: 'transcript_fast_path',
        acquisitionDurationMs: Date.now() - startedAt,
        language:
          typeof payload?.language === 'string'
            ? payload.language
            : cues.find((cue) => cue.lang)?.lang || null,
        cues,
      };
    } catch (error: any) {
      if (error instanceof IngestionFailure) throw error;
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        if (attempt < maximumAttempts) continue;
        throw new IngestionFailure({
          message: 'YouTube transcript proxy timed out',
          errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
          userMessage: 'The transcript provider timed out. Please retry shortly.',
          retryable: true,
          provider: 'proxy',
          cause: error,
        });
      }
      if (attempt < maximumAttempts) continue;
      throw new IngestionFailure({
        message: `YouTube transcript proxy request failed: ${error?.message || 'network error'}`,
        errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
        userMessage: 'The transcript provider could not be reached. Please retry shortly.',
        retryable: true,
        provider: 'proxy',
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new IngestionFailure({
    message: 'YouTube transcript proxy exhausted all attempts',
    errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
    userMessage: 'The transcript provider could not be reached. Please retry shortly.',
    retryable: true,
    provider: 'proxy',
  });
}

export async function fetchYouTubeTranscript(
  videoId: string,
  config?: YouTubeTranscriptProviderConfig,
  dependencies: YouTubeTranscriptProviderDependencies = {},
): Promise<YouTubeTranscriptResult> {
  if (config) {
    return config.provider === 'proxy'
      ? fetchProxyTranscript(videoId, config, dependencies)
      : fetchDirectTranscript(videoId, config, dependencies);
  }

  const log = dependencies.logger || logger;
  const runtime = dependencies.runtimeConfig || (() => {
    const env = getServerEnv();
    return {
      geminiApiKey: env.GEMINI_API_KEY,
      fastPath: env.YOUTUBE_TRANSCRIPT_PROVIDER === 'proxy'
        ? {
            provider: 'proxy' as const,
            timeoutMs: env.YOUTUBE_TRANSCRIPT_TIMEOUT_MS,
            proxyUrl: env.YOUTUBE_TRANSCRIPT_PROXY_URL,
            proxyToken: env.YOUTUBE_TRANSCRIPT_PROXY_TOKEN,
            maxAttempts: 1,
          }
        : undefined,
    };
  })();

  if (runtime.fastPath) {
    const fastPathStartedAt = Date.now();
    log.info('YOUTUBE_ACQUISITION_STRATEGY_STARTED', {
      videoId,
      strategy: 'transcript_fast_path',
      provider: runtime.fastPath.provider,
    });
    try {
      const result = runtime.fastPath.provider === 'proxy'
        ? await fetchProxyTranscript(videoId, runtime.fastPath, dependencies)
        : await fetchDirectTranscript(videoId, runtime.fastPath, dependencies);
      log.info('YOUTUBE_ACQUISITION_STRATEGY_RESULT', {
        videoId,
        strategy: result.strategy,
        provider: result.provider,
        durationMs: Date.now() - fastPathStartedAt,
        segmentCount: result.cues.length,
        textLength: transcriptTextLength(result.cues),
        classification: 'SUCCESS',
      });
      return result;
    } catch (error) {
      const classification = error instanceof IngestionFailure
        ? error.errorCode
        : 'UNKNOWN_ERROR';
      log.info('YOUTUBE_ACQUISITION_STRATEGY_RESULT', {
        videoId,
        strategy: 'transcript_fast_path',
        provider: runtime.fastPath.provider,
        durationMs: Date.now() - fastPathStartedAt,
        segmentCount: 0,
        textLength: 0,
        classification,
      });
      log.info('YOUTUBE_ACQUISITION_FALLBACK', {
        videoId,
        fromStrategy: 'transcript_fast_path',
        toStrategy: 'gemini_native',
        reason: classification,
      });
    }
  }

  const geminiStartedAt = Date.now();
  log.info('YOUTUBE_ACQUISITION_STRATEGY_STARTED', {
    videoId,
    strategy: 'gemini_native',
    provider: 'gemini',
  });
  try {
    const result = await fetchGeminiTranscript(
      videoId,
      runtime.geminiApiKey,
      dependencies,
    );
    log.info('YOUTUBE_ACQUISITION_STRATEGY_RESULT', {
      videoId,
      strategy: result.strategy,
      provider: result.provider,
      durationMs: Date.now() - geminiStartedAt,
      segmentCount: result.cues.length,
      textLength: transcriptTextLength(result.cues),
      classification: 'SUCCESS',
    });
    return result;
  } catch (error) {
    log.info('YOUTUBE_ACQUISITION_STRATEGY_RESULT', {
      videoId,
      strategy: 'gemini_native',
      provider: 'gemini',
      durationMs: Date.now() - geminiStartedAt,
      segmentCount: 0,
      textLength: 0,
      classification: error instanceof IngestionFailure
        ? error.errorCode
        : 'UNKNOWN_ERROR',
    });
    throw error;
  }
}
