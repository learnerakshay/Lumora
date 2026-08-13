export const YOUTUBE_INGESTION_GUIDANCE =
  'For best results, use videos with clear spoken audio. Videos with little or no speech, restricted access, or unsupported content may not be ingestible.';

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

  if (
    errorCode === 'NO_SPEECH_DETECTED' ||
    /no (?:usable|discernible) (?:spoken content|speech)/i.test(errorMessage)
  ) {
    return {
      title: 'No usable spoken content was detected in this video.',
      detail: 'Try another video with clear spoken audio.',
    };
  }

  if (
    errorCode === 'VIDEO_UNAVAILABLE' ||
    /unavailable|not public|could not be accessed|private|restricted/i.test(errorMessage)
  ) {
    return {
      title: 'This video could not be accessed.',
      detail: 'It may be private, unavailable, or restricted.',
    };
  }

  if (retryable || errorCode === 'TRANSCRIPT_PROVIDER_ERROR') {
    return {
      title: 'YouTube processing failed temporarily.',
      detail: 'Reprocess the source to try again.',
    };
  }

  return {
    title: 'This YouTube video could not be processed.',
    detail: 'Check that the video is public and contains clear spoken audio.',
  };
}
