import { load } from 'cheerio';
import { SourceType } from '../source-store';
import { cleanExtractedText } from './cleaner';
import { safeFetch } from './safe-fetch';
import { extractYouTubeVideoId } from './youtube-url';
import { IngestionFailure } from './errors';
import { fetchYouTubeTranscript } from './youtube-transcript-provider';

const PDF_MAX_BYTES = 20 * 1024 * 1024;
const WEBSITE_MAX_BYTES = 5 * 1024 * 1024;
const TEXT_MAX_BYTES = 2 * 1024 * 1024;
const VTT_MAX_BYTES = 2 * 1024 * 1024;

export const PARSER_VERSIONS: Record<SourceType, string> = {
  PDF: 'pdfjs-1',
  WEBSITE: 'cheerio-1',
  TEXT: 'plain-text-1',
  YOUTUBE: 'youtube-transcript-1',
  VTT: 'webvtt-1',
};

export interface ParsedSourceOutput {
  title: string;
  rawText: string;
  cleanText: string;
  originalContent: string | null;
  artifactData?: Uint8Array | null;
  artifactFileName?: string | null;
  artifactMimeType?: string | null;
  artifactSize?: number | null;
  sourceUrl?: string | null;
  metadata: Record<string, any>;
  parserVersion: string;
}

export interface ParseSourceInput {
  type: SourceType;
  title: string;
  sourceUrl?: string | null;
  originalContent?: string | null;
  artifactData?: Uint8Array | null;
  artifactFileName?: string | null;
  artifactMimeType?: string | null;
  parserMetadata?: Record<string, any> | null;
  onParsing?: () => Promise<void>;
  onHeartbeat?: () => Promise<void>;
}

function assertTextSize(text: string, maximumBytes: number, label: string): void {
  const size = Buffer.byteLength(text, 'utf8');
  if (size > maximumBytes) {
    throw new Error(`${label} exceeds the ${maximumBytes}-byte size limit`);
  }
}

function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(data);
}

export async function parseSourceContent(
  input: ParseSourceInput,
): Promise<ParsedSourceOutput> {
  switch (input.type) {
    case 'PDF':
      return parsePdfSource(input);
    case 'WEBSITE':
      return parseWebsiteSource(input);
    case 'TEXT':
      return parsePlainTextSource(input);
    case 'YOUTUBE':
      return parseYouTubeSource(input);
    case 'VTT':
      return parseVttSource(input);
    default:
      throw new Error(`No parser is registered for source type "${input.type}"`);
  }
}

async function parsePdfSource(
  input: ParseSourceInput,
): Promise<ParsedSourceOutput> {
  let data = input.artifactData || null;
  let sourceUrl = input.sourceUrl || null;
  let mimeType = input.artifactMimeType || null;

  if (!data && sourceUrl) {
    const fetched = await safeFetch(sourceUrl, {
      maximumBytes: PDF_MAX_BYTES,
      allowedContentTypes: ['application/pdf'],
    });
    data = fetched.data;
    sourceUrl = fetched.finalUrl;
    mimeType = fetched.contentType;
  }

  if (!data?.byteLength) {
    throw new IngestionFailure({
      message: 'PDF artifact is missing',
      errorCode: 'SOURCE_ARTIFACT_MISSING',
      userMessage:
        'The uploaded PDF is no longer available. Remove it and add the file again.',
    });
  }
  if (data.byteLength > PDF_MAX_BYTES) {
    throw new IngestionFailure({
      message: 'PDF exceeds the 20 MB size limit',
      errorCode: 'VALIDATION_ERROR',
      userMessage: 'PDF files cannot exceed 20 MB.',
    });
  }
  if (mimeType !== 'application/pdf') {
    throw new IngestionFailure({
      message: 'Uploaded file must have MIME type application/pdf',
      errorCode: 'PARSING_ERROR',
      userMessage: 'This file does not appear to be a valid PDF.',
    });
  }

  const header = Buffer.from(data.subarray(0, 5)).toString('ascii');
  if (header !== '%PDF-') {
    throw new IngestionFailure({
      message: 'Uploaded artifact does not contain a valid PDF signature',
      errorCode: 'PARSING_ERROR',
      userMessage: 'This file does not appear to be a valid PDF.',
    });
  }
  const searchableBytes = Buffer.from(data).toString('latin1');
  if (/\/Encrypt\b/.test(searchableBytes)) {
    throw new IngestionFailure({
      message: 'Encrypted or password-protected PDF files are not supported',
      errorCode: 'PARSING_ERROR',
      userMessage: 'Encrypted or password-protected PDF files are not supported.',
    });
  }

  await input.onParsing?.();

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(data),
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const document = await loadingTask.promise;
    const pages: Array<{
      pageNumber: number;
      text: string;
      characterStart: number;
      characterEnd: number;
    }> = [];
    const pageBlocks: string[] = [];
    let characterOffset = 0;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = cleanExtractedText(
        textContent.items
          .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
          .filter(Boolean)
          .join(' '),
      );
      const block = `[Page ${pageNumber}]\n${pageText}`;
      pages.push({
        pageNumber,
        text: pageText,
        characterStart: characterOffset,
        characterEnd: characterOffset + block.length,
      });
      pageBlocks.push(block);
      characterOffset += block.length + 2;
      if (pageNumber % 10 === 0 || pageNumber === document.numPages) {
        await input.onHeartbeat?.();
      }
    }

    const cleanText = cleanExtractedText(pageBlocks.join('\n\n'));
    if (!cleanText || pages.every((page) => !page.text)) {
      throw new Error('PDF contains no extractable text');
    }

    const documentMetadata = await document.getMetadata().catch(() => null);
    await document.destroy();

    return {
      title: input.title,
      rawText: pageBlocks.join('\n\n'),
      cleanText,
      originalContent: null,
      artifactData: data,
      artifactFileName: input.artifactFileName,
      artifactMimeType: 'application/pdf',
      artifactSize: data.byteLength,
      sourceUrl,
      metadata: {
        sourceType: 'PDF',
        pageCount: pages.length,
        pages,
        documentInfo: documentMetadata?.info || null,
        parsedAt: new Date().toISOString(),
      },
      parserVersion: PARSER_VERSIONS.PDF,
    };
  } catch (error: any) {
    if (error instanceof IngestionFailure) throw error;
    const message = error?.message || 'unknown PDF parser failure';
    if (/password/i.test(message)) {
      throw new IngestionFailure({
        message: 'Encrypted or password-protected PDF files are not supported',
        errorCode: 'PARSING_ERROR',
        userMessage: 'Encrypted or password-protected PDF files are not supported.',
        cause: error,
      });
    }
    throw new IngestionFailure({
      message: `PDF parsing failed: ${message}`,
      errorCode: 'PARSING_ERROR',
      userMessage: 'Lumora received the PDF but could not extract readable content.',
      cause: error,
    });
  }
}

function extractHtmlContent(html: string): {
  title: string;
  text: string;
  description: string | null;
} {
  const $ = load(html);
  $('script, style, noscript, template, svg, nav, footer, header, form').remove();
  $('br').replaceWith('\n');
  $('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, tr').each((_, element) => {
    $(element).append('\n\n');
  });

  const root = $('main').first().length
    ? $('main').first()
    : $('article').first().length
      ? $('article').first()
      : $('body');
  return {
    title: cleanExtractedText($('title').first().text()),
    text: cleanExtractedText(root.text()),
    description:
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      null,
  };
}

function assertWebsiteIsReadableStaticContent(html: string): void {
  const $ = load(html);
  const title = $('title').first().text().toLowerCase();
  const visibleText = cleanExtractedText($('body').text()).toLowerCase();
  const challengeMarkers = [
    'verify you are human',
    'checking your browser',
    'just a moment',
    'enable javascript and cookies',
    'captcha',
    'access denied',
  ];
  if (
    challengeMarkers.some((marker) => title.includes(marker) || visibleText.includes(marker))
  ) {
    throw new IngestionFailure({
      message: 'Website returned a bot or browser challenge page',
      errorCode: 'WEBSITE_CHALLENGE_PAGE',
      userMessage: 'This website blocked automated access with a browser challenge.',
      retryable: true,
    });
  }

  const hasPasswordField = $('input[type="password"]').length > 0;
  const loginTitle = /(^|\s)(log[ -]?in|sign[ -]?in)(\s|$)/i.test(title);
  if (hasPasswordField || (loginTitle && visibleText.length < 5_000)) {
    throw new IngestionFailure({
      message: 'Website returned a login or authentication page',
      errorCode: 'WEBSITE_AUTH_REQUIRED',
      userMessage: 'This webpage requires authentication and cannot be ingested.',
    });
  }
}

async function parseWebsiteSource(
  input: ParseSourceInput,
): Promise<ParsedSourceOutput> {
  let html =
    input.originalContent && /<html|<!doctype|<body/i.test(input.originalContent)
      ? input.originalContent
      : '';
  let sourceUrl = input.sourceUrl || null;
  let mimeType = input.artifactMimeType || 'text/html';

  if (!html) {
    if (!sourceUrl) throw new Error('Website URL is missing');
    const fetched = await safeFetch(sourceUrl, {
      maximumBytes: WEBSITE_MAX_BYTES,
      allowedContentTypes: ['text/html', 'application/xhtml+xml'],
    });
    html = decodeUtf8(fetched.data);
    sourceUrl = fetched.finalUrl;
    mimeType = fetched.contentType;
  }
  assertTextSize(html, WEBSITE_MAX_BYTES, 'Website HTML');
  await input.onParsing?.();
  assertWebsiteIsReadableStaticContent(html);

  const extracted = extractHtmlContent(html);
  if (extracted.text.length < 20) {
    throw new IngestionFailure({
      message: 'Website extraction produced no meaningful readable static content',
      errorCode: 'WEBSITE_INSUFFICIENT_CONTENT',
      userMessage:
        'The webpage did not contain enough readable static content. JavaScript-only pages are not supported.',
    });
  }

  const url = new URL(sourceUrl!);
  return {
    title: extracted.title || input.title,
    rawText: extracted.text,
    cleanText: extracted.text,
    originalContent: html,
    artifactMimeType: mimeType,
    artifactSize: Buffer.byteLength(html, 'utf8'),
    sourceUrl,
    metadata: {
      sourceType: 'WEBSITE',
      url: sourceUrl,
      domain: url.hostname,
      description: extracted.description,
      characters: extracted.text.length,
      parsedAt: new Date().toISOString(),
    },
    parserVersion: PARSER_VERSIONS.WEBSITE,
  };
}

async function parsePlainTextSource(
  input: ParseSourceInput,
): Promise<ParsedSourceOutput> {
  const original = input.originalContent || '';
  assertTextSize(original, TEXT_MAX_BYTES, 'Plain text source');
  await input.onParsing?.();
  const cleanText = cleanExtractedText(original);
  if (cleanText.length < 5) {
    throw new Error('Plain text source contains no meaningful content');
  }

  return {
    title: input.title,
    rawText: original,
    cleanText,
    originalContent: original,
    artifactMimeType: input.artifactMimeType || 'text/plain',
    artifactSize: Buffer.byteLength(original, 'utf8'),
    sourceUrl: input.sourceUrl,
    metadata: {
      sourceType: 'TEXT',
      characters: cleanText.length,
      wordCount: cleanText.split(/\s+/).length,
      parsedAt: new Date().toISOString(),
    },
    parserVersion: PARSER_VERSIONS.TEXT,
  };
}

export interface YouTubeExtractionQuality {
  segmentCount: number;
  textLength: number;
  timestampStartMs: number;
  timestampEndMs: number;
  timestampSpanMs: number;
  spokenDurationMs: number;
  charactersPerMinute: number;
  suspiciouslyThin: boolean;
}

const LONG_TRANSCRIPT_SPAN_MS = 10 * 60 * 1_000;
const THIN_TRANSCRIPT_MAX_CHARACTERS = 800;
const THIN_TRANSCRIPT_MAX_CHARACTERS_PER_MINUTE = 80;

export function assessYouTubeExtractionQuality(
  cues: Array<{ text: string; offset: number; duration: number }>,
): YouTubeExtractionQuality {
  if (!Array.isArray(cues) || cues.length === 0) {
    throw new IngestionFailure({
      message: 'YouTube extraction contained no timestamped segments',
      errorCode: 'PROVIDER_MALFORMED_RESPONSE',
      userMessage: 'We could not finish processing this video because the extraction was incomplete. Please try again shortly.',
      retryable: true,
      provider: 'youtube',
    });
  }

  let previousOffset = -1;
  let timestampStartMs = Number.POSITIVE_INFINITY;
  let timestampEndMs = 0;
  let spokenDurationMs = 0;
  let textLength = 0;
  for (const [index, cue] of cues.entries()) {
    if (
      !cue ||
      typeof cue.text !== 'string' ||
      !cue.text.trim() ||
      !Number.isFinite(cue.offset) ||
      cue.offset < 0 ||
      cue.offset < previousOffset ||
      !Number.isFinite(cue.duration) ||
      cue.duration < 0
    ) {
      throw new IngestionFailure({
        message: `YouTube extraction contained an invalid segment at index ${index}`,
        errorCode: 'PROVIDER_MALFORMED_RESPONSE',
        userMessage: 'We could not finish processing this video because the extraction was incomplete. Please try again shortly.',
        retryable: true,
        provider: 'youtube',
      });
    }
    previousOffset = cue.offset;
    timestampStartMs = Math.min(timestampStartMs, cue.offset);
    timestampEndMs = Math.max(timestampEndMs, cue.offset + cue.duration);
    spokenDurationMs += cue.duration;
    textLength += cue.text.trim().length;
  }

  const timestampSpanMs = Math.max(0, timestampEndMs - timestampStartMs);
  const charactersPerMinute = timestampSpanMs > 0
    ? textLength / (timestampSpanMs / 60_000)
    : textLength;
  const suspiciouslyThin =
    timestampSpanMs >= LONG_TRANSCRIPT_SPAN_MS &&
    textLength < THIN_TRANSCRIPT_MAX_CHARACTERS &&
    charactersPerMinute < THIN_TRANSCRIPT_MAX_CHARACTERS_PER_MINUTE;

  return {
    segmentCount: cues.length,
    textLength,
    timestampStartMs,
    timestampEndMs,
    timestampSpanMs,
    spokenDurationMs,
    charactersPerMinute,
    suspiciouslyThin,
  };
}

async function parseYouTubeSource(
  input: ParseSourceInput,
): Promise<ParsedSourceOutput> {
  const sourceUrl = input.sourceUrl || '';
  const videoId = extractYouTubeVideoId(sourceUrl);
  if (!videoId) throw new Error('YouTube URL does not contain a valid video ID');

  let storedTranscript: {
    kind: string;
    language: string | null;
    provider?: 'direct' | 'proxy' | 'gemini';
    strategy?: 'transcript_fast_path' | 'gemini_native';
    cues: Array<{ text: string; offset: number; duration: number; lang?: string }>;
  } | null = null;
  if (input.originalContent?.startsWith('{"kind":"youtube-transcript-v1"')) {
    try {
      storedTranscript = JSON.parse(input.originalContent);
    } catch {
      throw new Error('Persisted YouTube transcript artifact is invalid');
    }
  }

  let cues = storedTranscript?.cues || [];
  let provider: 'persisted' | 'direct' | 'proxy' | 'gemini' = 'persisted';
  let strategy = storedTranscript?.strategy || null;
  let acquisitionDurationMs: number | null = null;
  let providerLanguage: string | null = storedTranscript?.language || null;

  if (cues.length === 0) {
    const transcript = await fetchYouTubeTranscript(videoId);
    cues = transcript.cues;
    provider = transcript.provider;
    strategy = transcript.strategy;
    acquisitionDurationMs = transcript.acquisitionDurationMs;
    providerLanguage = transcript.language;
  }
  const extractionQuality = assessYouTubeExtractionQuality(cues);
  if (extractionQuality.suspiciouslyThin) {
    throw new IngestionFailure({
      message: `YouTube extraction was suspiciously thin (${extractionQuality.segmentCount} segments, ${extractionQuality.textLength} characters, ${extractionQuality.timestampSpanMs}ms span)`,
      errorCode: 'PROVIDER_MALFORMED_RESPONSE',
      userMessage: 'We could not finish processing this video because the extraction appeared incomplete. Please try again shortly.',
      retryable: true,
      provider: provider === 'persisted' ? storedTranscript?.provider || 'youtube' : provider,
    });
  }
  await input.onParsing?.();
  if (!Array.isArray(cues) || cues.length === 0) {
    throw new Error('YouTube transcript is unavailable or empty');
  }

  const language = providerLanguage || cues.find((cue) => cue.lang)?.lang || null;
  const preserved = {
    kind: 'youtube-transcript-v1',
    language,
    provider: provider === 'persisted' ? storedTranscript?.provider || null : provider,
    strategy,
    cues: cues.map((cue) => ({
      text: cue.text,
      offset: cue.offset,
      duration: cue.duration,
      lang: cue.lang,
    })),
  };
  const rawText = preserved.cues
    .map(
      (cue) =>
        `[${formatMilliseconds(cue.offset)} - ${formatMilliseconds(
          cue.offset + cue.duration,
        )}] ${cue.text}`,
    )
    .join('\n');
  const cleanText = cleanExtractedText(rawText);
  if (!cleanText) throw new Error('YouTube transcript contains no readable text');

  return {
    title: input.title,
    rawText,
    cleanText,
    originalContent: JSON.stringify(preserved),
    artifactMimeType: 'application/vnd.lumora.youtube-transcript+json',
    artifactSize: Buffer.byteLength(JSON.stringify(preserved), 'utf8'),
    sourceUrl,
    metadata: {
      sourceType: 'YOUTUBE',
      videoId,
      url: sourceUrl,
      language,
      transcriptProvider: provider,
      transcriptStrategy: strategy,
      acquisitionDurationMs,
      cueCount: preserved.cues.length,
      extractionTextLength: extractionQuality.textLength,
      timestampStartMs: extractionQuality.timestampStartMs,
      timestampEndMs: extractionQuality.timestampEndMs,
      timestampSpanMs: extractionQuality.timestampSpanMs,
      spokenDurationMs: extractionQuality.spokenDurationMs,
      charactersPerMinute: extractionQuality.charactersPerMinute,
      extractionQuality: 'passed',
      cues: preserved.cues,
      parsedAt: new Date().toISOString(),
    },
    parserVersion: PARSER_VERSIONS.YOUTUBE,
  };
}

function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.some(Number.isNaN) || parts.length < 2 || parts.length > 3) {
    throw new Error(`Invalid VTT timestamp "${timestamp}"`);
  }
  const seconds =
    parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
  return Math.round(seconds * 1000);
}

function formatMilliseconds(milliseconds: number): string {
  const totalSeconds = milliseconds / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = (totalSeconds % 60).toFixed(3).padStart(6, '0');
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds}`;
}

export function parseVttDocument(vtt: string): Array<{
  identifier: string | null;
  startMs: number;
  endMs: number;
  speaker: string | null;
  text: string;
}> {
  if (!vtt.trimStart().startsWith('WEBVTT')) {
    throw new Error('VTT source must begin with a WEBVTT header');
  }

  const blocks = vtt.replace(/^\uFEFF/, '').split(/\r?\n\r?\n+/).slice(1);
  const cues: Array<{
    identifier: string | null;
    startMs: number;
    endMs: number;
    speaker: string | null;
    text: string;
  }> = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim());
    if (!lines.length || /^(NOTE|STYLE|REGION)(\s|$)/i.test(lines[0])) continue;
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;

    const timing = lines[timingIndex].match(
      /^(\d{2}:\d{2}(?::\d{2})?\.\d{3})\s+-->\s+(\d{2}:\d{2}(?::\d{2})?\.\d{3})(?:\s+.*)?$/,
    );
    if (!timing) throw new Error(`Invalid VTT cue timing "${lines[timingIndex]}"`);

    const cueMarkup = lines.slice(timingIndex + 1).join('\n').trim();
    const speaker = cueMarkup.match(/<v(?:\.[^ >]+)*\s+([^>]+)>/i)?.[1]?.trim() || null;
    const text = cleanExtractedText(cueMarkup.replace(/<[^>]+>/g, ' '));
    if (!text) continue;

    const startMs = parseTimestamp(timing[1]);
    const endMs = parseTimestamp(timing[2]);
    if (endMs <= startMs) throw new Error('VTT cue end time must follow start time');

    cues.push({
      identifier: timingIndex > 0 ? lines[0] || null : null,
      startMs,
      endMs,
      speaker,
      text,
    });
  }
  if (cues.length === 0) throw new Error('VTT source contains no valid caption cues');
  return cues;
}

async function parseVttSource(
  input: ParseSourceInput,
): Promise<ParsedSourceOutput> {
  let original = input.originalContent || '';
  let sourceUrl = input.sourceUrl || null;
  let mimeType = input.artifactMimeType || 'text/vtt';

  if (!original && sourceUrl) {
    const fetched = await safeFetch(sourceUrl, {
      maximumBytes: VTT_MAX_BYTES,
      allowedContentTypes: ['text/vtt', 'text/plain'],
    });
    original = decodeUtf8(fetched.data);
    sourceUrl = fetched.finalUrl;
    mimeType = fetched.contentType;
  }
  assertTextSize(original, VTT_MAX_BYTES, 'VTT source');
  await input.onParsing?.();

  const cues = parseVttDocument(original);
  const rawText = cues
    .map(
      (cue) =>
        `[${formatMilliseconds(cue.startMs)} --> ${formatMilliseconds(cue.endMs)}] ${
          cue.speaker ? `${cue.speaker}: ` : ''
        }${cue.text}`,
    )
    .join('\n');
  const cleanText = cleanExtractedText(rawText);

  return {
    title: input.title,
    rawText,
    cleanText,
    originalContent: original,
    artifactFileName: input.artifactFileName,
    artifactMimeType: mimeType,
    artifactSize: Buffer.byteLength(original, 'utf8'),
    sourceUrl,
    metadata: {
      sourceType: 'VTT',
      cueCount: cues.length,
      cues,
      speakers: [...new Set(cues.map((cue) => cue.speaker).filter(Boolean))],
      parsedAt: new Date().toISOString(),
    },
    parserVersion: PARSER_VERSIONS.VTT,
  };
}
