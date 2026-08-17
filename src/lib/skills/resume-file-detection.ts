export type ResumeFileKind = 'PDF' | 'IMAGE_JPEG' | 'IMAGE_PNG' | 'IMAGE_WEBP';

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function matchesSignature(buffer: Uint8Array, signature: readonly number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

function isWebp(buffer: Uint8Array): boolean {
  if (buffer.length < 12) return false;
  return (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // "RIFF"
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50 // "WEBP"
  );
}

// Never trust a client-reported filename or Content-Type: the resume upload
// is classified from its own magic bytes, the same way parsePdfSource
// independently verifies the "%PDF-" header regardless of what was claimed.
export function detectResumeFileKind(buffer: Uint8Array): ResumeFileKind | null {
  if (matchesSignature(buffer, PDF_SIGNATURE)) return 'PDF';
  if (matchesSignature(buffer, PNG_SIGNATURE)) return 'IMAGE_PNG';
  if (matchesSignature(buffer, JPEG_SIGNATURE)) return 'IMAGE_JPEG';
  if (isWebp(buffer)) return 'IMAGE_WEBP';
  return null;
}

export function isResumeImageKind(
  kind: ResumeFileKind,
): kind is 'IMAGE_JPEG' | 'IMAGE_PNG' | 'IMAGE_WEBP' {
  return kind === 'IMAGE_JPEG' || kind === 'IMAGE_PNG' || kind === 'IMAGE_WEBP';
}

export function resumeImageMimeType(kind: 'IMAGE_JPEG' | 'IMAGE_PNG' | 'IMAGE_WEBP'): string {
  if (kind === 'IMAGE_JPEG') return 'image/jpeg';
  if (kind === 'IMAGE_PNG') return 'image/png';
  return 'image/webp';
}
