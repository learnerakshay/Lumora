const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);

export function extractYouTubeVideoId(url: string): string | null {
  if (typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;

  const hostname = parsed.hostname.toLowerCase();
  const isYoutubeHost = YOUTUBE_HOSTS.has(hostname);
  const isShortHost = hostname === 'youtu.be';

  if (!isYoutubeHost && !isShortHost) {
    return null;
  }

  if (isShortHost) {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length !== 1) return null;
    const videoId = parts[0];
    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  }

  const path = parsed.pathname;
  const lowercasePath = path.toLowerCase();
  if (lowercasePath === '/' || lowercasePath === '') {
    return null;
  }

  if (lowercasePath === '/watch') {
    const videoId = parsed.searchParams.get('v');
    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  }

  const shortsMatch = path.match(/^\/shorts\/([^/?#]+)\/?$/);
  if (shortsMatch) {
    const videoId = shortsMatch[1];
    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  }

  const embedMatch = path.match(/^\/embed\/([^/?#]+)\/?$/);
  if (embedMatch) {
    const videoId = embedMatch[1];
    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  }

  return null;
}

export function canonicalizeYouTubeUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

export function buildYouTubeTimestampUrl(
  url: string | null | undefined,
  timestampMs: number | null | undefined,
): string | null {
  if (
    !url ||
    !Number.isFinite(timestampMs) ||
    !Number.isInteger(timestampMs) ||
    timestampMs! < 0
  ) {
    return null;
  }
  const canonicalUrl = canonicalizeYouTubeUrl(url);
  if (!canonicalUrl) return null;
  return `${canonicalUrl}&t=${Math.floor(timestampMs! / 1_000)}s`;
}
