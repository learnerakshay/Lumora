const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

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
  const isYoutubeHost =
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'music.youtube.com' ||
    hostname.endsWith('.youtube.com');
  const isShortHost = hostname === 'youtu.be';

  if (!isYoutubeHost && !isShortHost) {
    return null;
  }

  if (isShortHost) {
    const videoId = parsed.pathname.split('/').filter(Boolean)[0];
    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  }

  const path = parsed.pathname;
  const lowercasePath = path.toLowerCase();
  if (lowercasePath === '/' || lowercasePath === '') {
    return null;
  }

  if (lowercasePath.startsWith('/watch')) {
    const videoId = parsed.searchParams.get('v');
    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  }

  const shortsMatch = path.match(/^\/shorts\/([^/?#]+)/);
  if (shortsMatch) {
    const videoId = shortsMatch[1];
    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  }

  const embedMatch = path.match(/^\/embed\/([^/?#]+)/);
  if (embedMatch) {
    const videoId = embedMatch[1];
    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  }

  return null;
}
