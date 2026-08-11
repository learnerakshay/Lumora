import { getServerEnv } from '../env';
import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from 'youtube-transcript';
import { IngestionFailure } from './errors';
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
  provider: 'direct' | 'proxy';
  language: string | null;
  cues: YouTubeTranscriptCue[];
}

export interface YouTubeTranscriptProviderConfig {
  provider: 'direct' | 'proxy';
  timeoutMs: number;
  proxyUrl?: string;
  proxyToken?: string;
}

export interface YouTubeTranscriptProviderDependencies {
  fetchImpl?: typeof fetch;
  validateEndpoint?: typeof validatePublicHttpsUrl;
  directFetch?: (videoId: string) => Promise<YouTubeTranscriptCue[]>;
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

  const cues = value.map((cue, index) => {
    if (
      !cue ||
      typeof cue !== 'object' ||
      typeof (cue as any).text !== 'string' ||
      !(cue as any).text.trim() ||
      !Number.isFinite((cue as any).offset) ||
      (cue as any).offset < 0 ||
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
  const directFetch = dependencies.directFetch || YoutubeTranscript.fetchTranscript.bind(YoutubeTranscript);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutFailure = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        const error = new Error('Reference YouTube transcript extraction timed out');
        error.name = 'AbortError';
        reject(error);
      }, config.timeoutMs);
    });
    const cues = await Promise.race([directFetch(videoId), timeoutFailure]);
    const validated = validateCues(cues, 'direct');
    return {
      provider: 'direct',
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
  for (let attempt = 1; attempt <= MAX_PROXY_ATTEMPTS; attempt += 1) {
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
        if (attempt < MAX_PROXY_ATTEMPTS && retryableProviderStatus(response.status)) {
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
        language:
          typeof payload?.language === 'string'
            ? payload.language
            : cues.find((cue) => cue.lang)?.lang || null,
        cues,
      };
    } catch (error: any) {
      if (error instanceof IngestionFailure) throw error;
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        if (attempt < MAX_PROXY_ATTEMPTS) continue;
        throw new IngestionFailure({
          message: 'YouTube transcript proxy timed out',
          errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
          userMessage: 'The transcript provider timed out. Please retry shortly.',
          retryable: true,
          provider: 'proxy',
          cause: error,
        });
      }
      if (attempt < MAX_PROXY_ATTEMPTS) continue;
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
  const resolved = config || (() => {
    const env = getServerEnv();
    return {
      provider: 'direct' as const,
      timeoutMs: env.YOUTUBE_TRANSCRIPT_TIMEOUT_MS,
    };
  })();

  return resolved.provider === 'proxy'
    ? fetchProxyTranscript(videoId, resolved, dependencies)
    : fetchDirectTranscript(videoId, resolved, dependencies);
}
