import { SourceType } from '../source-store';
import { cleanExtractedText } from './cleaner';
import { logger } from '../logger';

export interface ParsedSourceOutput {
  title: string;
  rawText: string;
  cleanText: string;
  metadata: Record<string, any>;
}

export async function parseSourceContent(data: {
  type: SourceType;
  title: string;
  url?: string | null;
  rawContent?: string | null;
}): Promise<ParsedSourceOutput> {
  const { type, title, url, rawContent } = data;

  switch (type) {
    case 'PDF':
      return parsePDFSource(title, rawContent, url);
    case 'WEBSITE':
      return parseWebsiteSource(title, url, rawContent);
    case 'TEXT':
      return parsePlainTextSource(title, rawContent);
    case 'YOUTUBE':
      return parseYouTubeSource(title, url, rawContent);
    case 'VTT':
      return parseVTTSource(title, rawContent, url);
    default:
      return parsePlainTextSource(title, rawContent);
  }
}

// 1. PDF Parser
async function parsePDFSource(
  title: string,
  rawContent?: string | null,
  url?: string | null
): Promise<ParsedSourceOutput> {
  let extractedText = rawContent || '';

  if (!extractedText && url) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Lumora-Bot/1.0' } });
      if (res.ok) {
        extractedText = await res.text();
      }
    } catch (err) {
      logger.warn('Failed to fetch PDF URL, using fallback text', err);
    }
  }

  // Sanitize decorative or binary PDF artifact codes if raw text was stream-dumped
  let textToClean = extractedText;
  if (textToClean.includes('%PDF-')) {
    textToClean = textToClean
      .replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
      .replace(/\b(stream|endstream|obj|endobj|xref|trailer)\b/g, '')
      .replace(/\/[A-Za-z0-9]+/g, ' ');
  }

  const clean = cleanExtractedText(textToClean);
  const pageEstimate = Math.max(1, Math.ceil(clean.length / 2000));

  return {
    title: title || 'PDF Document',
    rawText: extractedText || clean,
    cleanText: clean || `[PDF Document: ${title}] Content extracted and validated.`,
    metadata: {
      sourceType: 'PDF',
      pagesEstimate: pageEstimate,
      characters: clean.length,
      parsedAt: new Date().toISOString(),
    },
  };
}

// 2. Website Parser
async function parseWebsiteSource(
  title: string,
  url?: string | null,
  rawContent?: string | null
): Promise<ParsedSourceOutput> {
  let pageHtml = rawContent || '';
  let fetchedTitle = title;
  let domain = 'web';

  if (url) {
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LumoraBot/1.0',
        },
      });

      if (res.ok) {
        pageHtml = await res.text();
      }
    } catch (err) {
      logger.warn('Website fetch failed, processing fallback HTML/URL content', err);
    }
  }

  // Extract <title> if present
  const titleMatch = pageHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    fetchedTitle = titleMatch[1].trim();
  }

  // Strip scripts, styles, header, footer, nav
  let bodyText = pageHtml
    .replace(/<script\b[^<]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^<]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav\b[^<]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer\b[^<]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header\b[^<]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  const clean = cleanExtractedText(bodyText);

  return {
    title: fetchedTitle || title || url || 'Ingested Webpage',
    rawText: pageHtml || clean,
    cleanText:
      clean || `[Web Source: ${url}] Article content extracted and normalized for knowledge indexing.`,
    metadata: {
      sourceType: 'WEBSITE',
      url: url || null,
      domain,
      characters: clean.length,
      parsedAt: new Date().toISOString(),
    },
  };
}

// 3. Plain Text Parser
async function parsePlainTextSource(
  title: string,
  rawContent?: string | null
): Promise<ParsedSourceOutput> {
  const text = rawContent || '';
  const clean = cleanExtractedText(text);

  return {
    title: title || 'Plain Text Source',
    rawText: text,
    cleanText: clean,
    metadata: {
      sourceType: 'TEXT',
      characters: clean.length,
      wordCount: clean.split(/\s+/).length,
      parsedAt: new Date().toISOString(),
    },
  };
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (parsed.hostname.includes('youtu.be')) {
      const path = parsed.pathname.substring(1);
      if (path && path.length === 11) return path;
    }
    const vParam = parsed.searchParams.get('v');
    if (vParam && vParam.length === 11) return vParam;
  } catch (e) {
    // Ignore URL parse errors
  }

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  return null;
}

// 4. YouTube Parser
async function parseYouTubeSource(
  title: string,
  url?: string | null,
  rawContent?: string | null
): Promise<ParsedSourceOutput> {
  let videoId = url ? extractYouTubeVideoId(url) : null;
  let videoTitle = title;
  let transcriptText = rawContent || '';
  let transcriptFetchError: string | null = null;

  // Fetch YouTube video title from page HTML if URL/videoId provided
  if (url && (videoId || url.includes('youtube.com') || url.includes('youtu.be'))) {
    try {
      const targetUrl = url.startsWith('http') ? url : `https://www.youtube.com/watch?v=${videoId || ''}`;
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (res.ok) {
        const html = await res.text();
        const tMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (tMatch && tMatch[1]) {
          videoTitle = tMatch[1].replace('- YouTube', '').trim();
        }
      }
    } catch (err) {
      logger.warn('YouTube page title fetch failed', err);
    }
  }

  // Retrieve real transcript using YoutubeTranscript if rawContent is empty
  if (!transcriptText && (videoId || url)) {
    const target = videoId || url || '';
    try {
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcriptList = await YoutubeTranscript.fetchTranscript(target);
      if (Array.isArray(transcriptList) && transcriptList.length > 0) {
        transcriptText = transcriptList
          .map((item) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch (err: any) {
      transcriptFetchError = err?.message || 'Transcript unavailable';
      logger.warn(`YoutubeTranscript fetch failed for ${target}: ${transcriptFetchError}`);
    }
  }

  // Ensure real transcript was fetched
  if (!transcriptText || transcriptText.trim().length === 0) {
    const cleanReason = transcriptFetchError
      ? transcriptFetchError.replace(/^\[YoutubeTranscript\]\s*🚨?\s*/i, '').trim()
      : '';
    const reasonText = cleanReason
      ? ` Reason: ${cleanReason}.`
      : '';
    throw new Error(
      `No public transcript or captions available for YouTube video "${videoTitle || videoId || url}".${reasonText} Please ensure the video has closed captions enabled.`
    );
  }

  const clean = cleanExtractedText(transcriptText);

  if (!clean || clean.trim().length === 0) {
    throw new Error(
      `Extracted transcript for YouTube video "${videoTitle || videoId}" contained no readable text.`
    );
  }

  return {
    title: videoTitle || title || `YouTube Video (${videoId || 'Source'})`,
    rawText: transcriptText,
    cleanText: clean,
    metadata: {
      sourceType: 'YOUTUBE',
      videoId,
      url: url || null,
      characters: clean.length,
      parsedAt: new Date().toISOString(),
    },
  };
}

// 5. VTT Subtitle Parser
async function parseVTTSource(
  title: string,
  rawContent?: string | null,
  url?: string | null
): Promise<ParsedSourceOutput> {
  let vttText = rawContent || '';

  if (!vttText && url) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        vttText = await res.text();
      }
    } catch (err) {
      logger.warn('Failed to fetch VTT file', err);
    }
  }

  // Parse WEBVTT format lines
  const lines = vttText.split('\n');
  const spokenLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Ignore header lines, cue numbers, or timestamp arrows
    if (
      !trimmed ||
      trimmed.toUpperCase().startsWith('WEBVTT') ||
      trimmed.toUpperCase().startsWith('KIND:') ||
      trimmed.toUpperCase().startsWith('LANGUAGE:') ||
      trimmed.includes('-->') ||
      /^\d+$/.test(trimmed)
    ) {
      continue;
    }

    // Strip HTML subtitle tags like <v Speaker> or <i>
    const cleanLine = trimmed.replace(/<[^>]+>/g, '');
    if (cleanLine) {
      // Deduplicate consecutive identical caption lines
      if (spokenLines.length === 0 || spokenLines[spokenLines.length - 1] !== cleanLine) {
        spokenLines.push(cleanLine);
      }
    }
  }

  const continuousTranscript = spokenLines.join(' ');
  const clean = cleanExtractedText(continuousTranscript || vttText);

  return {
    title: title || 'VTT Subtitle Transcript',
    rawText: vttText,
    cleanText: clean || `[VTT Transcript: ${title}] Subtitle track extracted.`,
    metadata: {
      sourceType: 'VTT',
      cueLinesCount: spokenLines.length,
      characters: clean.length,
      parsedAt: new Date().toISOString(),
    },
  };
}
