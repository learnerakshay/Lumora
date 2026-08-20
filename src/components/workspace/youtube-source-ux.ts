import type { ProcessingStage, SourceRecord } from '../../lib/source-store';

export const YOUTUBE_INGESTION_GUIDANCE =
  'For best results, use videos with clear spoken audio. Videos with little or no speech, restricted access, or unsupported content may not be ingestible.';

export const YOUTUBE_SLOW_PROCESSING_THRESHOLD_MS = 60_000;
export const YOUTUBE_SLOW_PROCESSING_NOTICE =
  'This video is taking a little longer than usual to process. Please be patient — Lumora is still preparing it for your Workspace.';

export function getYouTubeStageLabel(stage: ProcessingStage): string {
  if (stage === 'CREATED' || stage === 'QUEUED') return 'Queued';
  if (stage === 'PROCESSING' || stage === 'FETCHING') return 'Processing video';
  if (stage === 'PARSING' || stage === 'CHUNKING') return 'Preparing knowledge';
  if (stage === 'READY_FOR_INDEXING' || stage === 'EMBEDDING' || stage === 'INDEXING') {
    return 'Indexing knowledge';
  }
  if (stage === 'COMPLETED') return 'Ready';
  return 'Failed';
}

export function youtubeProcessingAttemptKey(source: SourceRecord): string {
  return `${source.id}:${source.currentVersion}`;
}

export function youtubeProcessingStartedAt(source: SourceRecord): number | null {
  const candidate = source.metadata?.claimedAt || source.createdAt;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function shouldShowYouTubeSlowProcessingNotice(
  source: SourceRecord,
  shownAttemptKeys: ReadonlySet<string>,
  now = Date.now(),
): boolean {
  if (
    source.type !== 'YOUTUBE' ||
    (source.status !== 'PENDING' && source.status !== 'PROCESSING') ||
    shownAttemptKeys.has(youtubeProcessingAttemptKey(source))
  ) {
    return false;
  }
  const startedAt = youtubeProcessingStartedAt(source);
  return startedAt !== null && now - startedAt >= YOUTUBE_SLOW_PROCESSING_THRESHOLD_MS;
}

export interface YouTubeFailureMessage {
  title: string;
  detail?: string;
}

export function getYouTubeFailureMessage(
  metadata?: Record<string, unknown> | null,
): YouTubeFailureMessage {
  const errorCode = typeof metadata?.errorCode === 'string' ? metadata.errorCode : '';
  const errorMessage = typeof metadata?.errorMessage === 'string' ? metadata.errorMessage : '';
  const retryable = metadata?.retryable === true;

  // A known errorCode is a structured, authoritative signal and must always
  // win over the errorMessage regex heuristics and the generic `retryable`
  // bucket below. Previously VIDEO_UNAVAILABLE's fallback regex
  // (`/.../restricted/i`) ran before the ACCESS_RESTRICTED errorCode check,
  // so a CONTENT_POLICY failure — whose userMessage is literally "...access
  // is restricted." — matched that regex on the word "restricted" and was
  // silently displayed as the wrong, less specific "This video could not be
  // accessed" message instead of its own ACCESS_RESTRICTED copy. Every
  // errorCode-specific branch now runs first; the message-regex fallbacks
  // only apply when errorCode didn't already resolve to a known case
  // (older/malformed metadata without a specific errorCode).
  if (errorCode === 'NO_SPEECH_DETECTED') {
    return {
      title: 'No usable spoken content was detected in this video.',
      detail: 'Try another video with clear spoken audio.',
    };
  }

  if (errorCode === 'ACCESS_RESTRICTED') {
    return {
      title: 'This video cannot be accessed for processing.',
      detail: 'The video or its content is restricted.',
    };
  }

  if (errorCode === 'VIDEO_UNAVAILABLE') {
    return {
      title: 'This video could not be accessed.',
      detail: 'It may be private, unavailable, or restricted.',
    };
  }

  if (/no (?:usable|discernible) (?:spoken content|speech)/i.test(errorMessage)) {
    return {
      title: 'No usable spoken content was detected in this video.',
      detail: 'Try another video with clear spoken audio.',
    };
  }

  if (/unavailable|not public|could not be accessed|private|restricted/i.test(errorMessage)) {
    return {
      title: 'This video could not be accessed.',
      detail: 'It may be private, unavailable, or restricted.',
    };
  }

  if (
    retryable ||
    errorCode === 'TRANSCRIPT_PROVIDER_ERROR' ||
    errorCode === 'PROVIDER_TIMEOUT' ||
    errorCode === 'PROVIDER_TEMPORARY_FAILURE' ||
    errorCode === 'PROVIDER_MALFORMED_RESPONSE'
  ) {
    return {
      title: 'We could not finish processing this video right now.',
      detail: 'Please try again shortly.',
    };
  }

  return {
    title: 'This YouTube video could not be processed.',
    detail: 'Check that the video is public and contains clear spoken audio.',
  };
}
