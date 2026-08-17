import assert from 'node:assert/strict';
import test from 'node:test';
import { detectResumeFileKind, isResumeImageKind, resumeImageMimeType } from './resume-file-detection';

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

const PDF_BYTES = bytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
const PNG_BYTES = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG_BYTES = bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_BYTES = bytes([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x00, 0x00, 0x00, 0x00, // chunk size (irrelevant)
  0x57, 0x45, 0x42, 0x50, // WEBP
]);

test('detects a PDF from its magic bytes regardless of file extension', () => {
  assert.equal(detectResumeFileKind(PDF_BYTES), 'PDF');
});

test('detects PNG, JPEG, and WEBP images from their magic bytes', () => {
  assert.equal(detectResumeFileKind(PNG_BYTES), 'IMAGE_PNG');
  assert.equal(detectResumeFileKind(JPEG_BYTES), 'IMAGE_JPEG');
  assert.equal(detectResumeFileKind(WEBP_BYTES), 'IMAGE_WEBP');
});

test('a file claiming to be an image but containing unrecognized bytes is rejected, not guessed', () => {
  assert.equal(detectResumeFileKind(bytes([0x00, 0x01, 0x02, 0x03, 0x04, 0x05])), null);
  assert.equal(detectResumeFileKind(bytes([])), null);
});

test('a WEBP-like buffer missing the WEBP marker is not misdetected', () => {
  const riffOnly = bytes([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20]); // RIFF...AVI (not WEBP)
  assert.equal(detectResumeFileKind(riffOnly), null);
});

test('a truncated buffer shorter than any signature is rejected rather than throwing', () => {
  assert.equal(detectResumeFileKind(bytes([0x25, 0x50])), null);
});

test('isResumeImageKind separates image kinds from PDF', () => {
  assert.equal(isResumeImageKind('IMAGE_PNG'), true);
  assert.equal(isResumeImageKind('IMAGE_JPEG'), true);
  assert.equal(isResumeImageKind('IMAGE_WEBP'), true);
  assert.equal(isResumeImageKind('PDF'), false);
});

test('resumeImageMimeType maps each image kind to its correct MIME type', () => {
  assert.equal(resumeImageMimeType('IMAGE_PNG'), 'image/png');
  assert.equal(resumeImageMimeType('IMAGE_JPEG'), 'image/jpeg');
  assert.equal(resumeImageMimeType('IMAGE_WEBP'), 'image/webp');
});
