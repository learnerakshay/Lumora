import { SourceType } from '../source-store';

export interface SourceValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

export function validateSourceInput(data: {
  workspaceId: string;
  title: string;
  type: SourceType;
  url?: string | null;
  fileSize?: string | null;
  rawContent?: string | null;
  existingSources?: Array<{ title: string; url?: string | null; metadata?: any }>;
}): SourceValidationResult {
  const { title, type, url, rawContent, existingSources = [] } = data;

  // 1. Title validation
  if (!title || typeof title !== 'string' || !title.trim()) {
    return { valid: false, error: 'Source title is required.' };
  }

  const cleanTitle = title.trim();

  // 2. Duplicate detection within workspace
  const isDuplicate = existingSources.some((s) => {
    if (s.title.toLowerCase() === cleanTitle.toLowerCase()) return true;
    if (url && s.url && s.url.trim().toLowerCase() === url.trim().toLowerCase()) return true;
    return false;
  });

  if (isDuplicate) {
    return {
      valid: false,
      error: `A source with title "${cleanTitle}" or identical URL already exists in this workspace.`,
    };
  }

  // 3. Type-specific validations
  if (type === 'WEBSITE') {
    if (!url || !url.trim()) {
      return { valid: false, error: 'A valid website URL is required for WEBSITE sources.' };
    }
    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return { valid: false, error: 'Website URL must start with http:// or https://' };
    }
    try {
      new URL(cleanUrl);
    } catch {
      return { valid: false, error: 'Malformed website URL format.' };
    }
    return { valid: true, normalizedUrl: cleanUrl };
  }

  if (type === 'YOUTUBE') {
    if (!url || !url.trim()) {
      return { valid: false, error: 'A valid YouTube URL is required.' };
    }
    const cleanUrl = url.trim();
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;
    if (!ytRegex.test(cleanUrl)) {
      return {
        valid: false,
        error: 'URL must be a valid YouTube link (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)',
      };
    }
    return { valid: true, normalizedUrl: cleanUrl };
  }

  if (type === 'TEXT') {
    if (!rawContent || !rawContent.trim()) {
      return { valid: false, error: 'Plain text content cannot be empty.' };
    }
    if (rawContent.trim().length < 5) {
      return { valid: false, error: 'Plain text content is too short (minimum 5 characters).' };
    }
    return { valid: true };
  }

  if (type === 'VTT') {
    if (!rawContent && !url) {
      return { valid: false, error: 'VTT caption content or subtitle file URL is required.' };
    }
    if (rawContent && rawContent.trim().length < 5) {
      return { valid: false, error: 'VTT transcript content is empty or invalid.' };
    }
    return { valid: true };
  }

  if (type === 'PDF') {
    if (!rawContent && !url) {
      return { valid: false, error: 'PDF file upload or valid document URL is required.' };
    }
    return { valid: true };
  }

  return { valid: true };
}
