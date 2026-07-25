import { SourceType } from '../source-store';
import { extractYouTubeVideoId } from './parsers';

export const SOURCE_LIMITS = {
  PDF_BYTES: 20 * 1024 * 1024,
  TEXT_BYTES: 2 * 1024 * 1024,
  VTT_BYTES: 2 * 1024 * 1024,
} as const;

export interface SourceValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

function normalizeHttpsUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function validateSourceInput(data: {
  workspaceId: string;
  title: string;
  type: SourceType;
  url?: string | null;
  rawContent?: string | null;
  file?: {
    size: number;
    mimetype: string;
    originalname: string;
    buffer: Uint8Array;
  } | null;
  existingSources?: Array<{ title: string; url?: string | null; metadata?: any }>;
}): SourceValidationResult {
  const { title, type, url, rawContent, file, existingSources = [] } = data;
  const cleanTitle = title?.trim();
  if (!cleanTitle) return { valid: false, error: 'Source title is required.' };
  if (cleanTitle.length > 200) {
    return { valid: false, error: 'Source title cannot exceed 200 characters.' };
  }

  const normalizedUrl = url ? normalizeHttpsUrl(url) : undefined;
  if (url && !normalizedUrl) {
    return {
      valid: false,
      error: 'Remote source URL must be a valid HTTPS URL without credentials.',
    };
  }

  const duplicate = existingSources.some((source) => {
    if (source.title.trim().toLowerCase() === cleanTitle.toLowerCase()) return true;
    const existingUrl = source.url || source.metadata?.url;
    return Boolean(
      normalizedUrl &&
        existingUrl &&
        normalizeHttpsUrl(existingUrl) === normalizedUrl,
    );
  });
  if (duplicate) {
    return {
      valid: false,
      error: `A source with title "${cleanTitle}" or the same URL already exists in this workspace.`,
    };
  }

  if (type === 'PDF') {
    if (!file && !normalizedUrl) {
      return { valid: false, error: 'A PDF upload or HTTPS PDF URL is required.' };
    }
    if (file) {
      if (file.mimetype !== 'application/pdf') {
        return { valid: false, error: 'Uploaded PDF must use MIME type application/pdf.' };
      }
      if (!file.originalname.toLowerCase().endsWith('.pdf')) {
        return { valid: false, error: 'Uploaded PDF must use a .pdf filename.' };
      }
      if (file.size <= 0 || file.size > SOURCE_LIMITS.PDF_BYTES) {
        return { valid: false, error: 'PDF file must be between 1 byte and 20 MB.' };
      }
      if (Buffer.from(file.buffer.subarray(0, 5)).toString('ascii') !== '%PDF-') {
        return { valid: false, error: 'Uploaded file does not contain a valid PDF signature.' };
      }
    }
  }

  if (type === 'WEBSITE' && !normalizedUrl) {
    return { valid: false, error: 'A valid HTTPS website URL is required.' };
  }

  if (type === 'YOUTUBE') {
    if (!normalizedUrl || !extractYouTubeVideoId(normalizedUrl)) {
      return { valid: false, error: 'A valid HTTPS YouTube video URL is required.' };
    }
  }

  if (type === 'TEXT') {
    const text = rawContent || '';
    const bytes = Buffer.byteLength(text, 'utf8');
    if (text.trim().length < 5) {
      return { valid: false, error: 'Plain text content must contain at least 5 characters.' };
    }
    if (bytes > SOURCE_LIMITS.TEXT_BYTES) {
      return { valid: false, error: 'Plain text content cannot exceed 2 MB.' };
    }
    if (file) {
      return { valid: false, error: 'Plain text sources must be submitted as text.' };
    }
  }

  if (type === 'VTT') {
    if (!file && !rawContent?.trim() && !normalizedUrl) {
      return { valid: false, error: 'A VTT file, VTT content, or HTTPS VTT URL is required.' };
    }
    if (file) {
      const allowedMimeTypes = ['text/vtt', 'text/plain', 'application/octet-stream'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return { valid: false, error: 'Uploaded VTT has an unsupported MIME type.' };
      }
      if (!file.originalname.toLowerCase().endsWith('.vtt')) {
        return { valid: false, error: 'Uploaded VTT must use a .vtt filename.' };
      }
      if (file.size <= 0 || file.size > SOURCE_LIMITS.VTT_BYTES) {
        return { valid: false, error: 'VTT file must be between 1 byte and 2 MB.' };
      }
    }
    if (
      rawContent &&
      Buffer.byteLength(rawContent, 'utf8') > SOURCE_LIMITS.VTT_BYTES
    ) {
      return { valid: false, error: 'VTT content cannot exceed 2 MB.' };
    }
  }

  return { valid: true, normalizedUrl };
}
