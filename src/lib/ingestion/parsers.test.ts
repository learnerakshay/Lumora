import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseSourceContent,
  parseVttDocument,
} from './parsers';
import {
  isPrivateNetworkAddress,
  validatePublicHttpsUrl,
} from './safe-fetch';
import { assertValidProcessingTransition } from '../source-store';
import { SOURCE_LIMITS, validateSourceInput } from './validators';

function createMinimalPdf(text: string): Uint8Array {
  const stream = `BT /F1 18 Tf 72 100 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];

  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    output += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'binary');
}

test('PDF parser preserves page text and rejects invalid artifacts', async () => {
  const parsed = await parseSourceContent({
    type: 'PDF',
    title: 'Test PDF',
    artifactData: createMinimalPdf('Lumora PDF ingestion works'),
    artifactMimeType: 'application/pdf',
    artifactFileName: 'test.pdf',
  });

  assert.match(parsed.cleanText, /Lumora PDF ingestion works/);
  assert.equal(parsed.metadata.pageCount, 1);
  assert.equal(parsed.metadata.pages[0].pageNumber, 1);
  assert.equal(parsed.parserVersion, 'pdfjs-1');

  await assert.rejects(
    parseSourceContent({
      type: 'PDF',
      title: 'Invalid PDF',
      artifactData: Buffer.from('not-a-pdf'),
      artifactMimeType: 'application/pdf',
    }),
    /valid PDF signature/,
  );
  await assert.rejects(
    parseSourceContent({
      type: 'PDF',
      title: 'Encrypted PDF',
      artifactData: Buffer.from('%PDF-1.4\n/Encrypt 1 0 R'),
      artifactMimeType: 'application/pdf',
    }),
    /Encrypted/,
  );
  await assert.rejects(
    parseSourceContent({
      type: 'PDF',
      title: 'Wrong MIME',
      artifactData: createMinimalPdf('text'),
      artifactMimeType: 'text/plain',
    }),
    /MIME type/,
  );
});

test('website parser extracts semantic HTML and rejects empty pages', async () => {
  const parsed = await parseSourceContent({
    type: 'WEBSITE',
    title: 'Website',
    sourceUrl: 'https://example.com/research',
    originalContent:
      '<!doctype html><html><head><title>Lumora Research</title></head><body><nav>Noise</nav><main><h1>Grounded research</h1><p>Useful production content for learners.</p></main></body></html>',
  });

  assert.equal(parsed.title, 'Lumora Research');
  assert.match(parsed.cleanText, /Grounded research/);
  assert.doesNotMatch(parsed.cleanText, /Noise/);
  assert.match(parsed.originalContent || '', /<!doctype html>/);

  await assert.rejects(
    parseSourceContent({
      type: 'WEBSITE',
      title: 'Empty',
      sourceUrl: 'https://example.com',
      originalContent: '<html><body><script>onlyNoise()</script></body></html>',
    }),
    /no meaningful/,
  );
});

test('plain text preserves the original and enforces size/content limits', async () => {
  const original = '  Immutable source text\n\nwith complete content.  ';
  const parsed = await parseSourceContent({
    type: 'TEXT',
    title: 'Text',
    originalContent: original,
  });
  assert.equal(parsed.originalContent, original);
  assert.equal(parsed.rawText, original);
  assert.match(parsed.cleanText, /Immutable source text/);

  await assert.rejects(
    parseSourceContent({ type: 'TEXT', title: 'Empty', originalContent: '  ' }),
    /meaningful/,
  );
  await assert.rejects(
    parseSourceContent({
      type: 'TEXT',
      title: 'Oversized',
      originalContent: 'a'.repeat(2 * 1024 * 1024 + 1),
    }),
    /size limit/,
  );
});

test('YouTube parser preserves persisted cue timestamps and language', async () => {
  const transcript = {
    kind: 'youtube-transcript-v1',
    language: 'en',
    cues: [
      { text: 'Welcome to Lumora', offset: 1000, duration: 2500, lang: 'en' },
      { text: 'Grounded learning', offset: 3500, duration: 2000, lang: 'en' },
    ],
  };
  const parsed = await parseSourceContent({
    type: 'YOUTUBE',
    title: 'Video',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    originalContent: JSON.stringify(transcript),
  });

  assert.equal(parsed.metadata.videoId, 'dQw4w9WgXcQ');
  assert.equal(parsed.metadata.language, 'en');
  assert.equal(parsed.metadata.cues[0].offset, 1000);
  assert.match(parsed.rawText, /00:00:01.000/);

  await assert.rejects(
    parseSourceContent({
      type: 'YOUTUBE',
      title: 'Invalid',
      sourceUrl: 'https://www.youtube.com/watch?v=invalid',
    }),
    /valid video ID/,
  );
});

test('VTT parser preserves timestamps, speakers, and original content', async () => {
  const vtt = `WEBVTT

intro
00:00:01.000 --> 00:00:03.500
<v Aksha>Welcome to Lumora.

00:00:04.000 --> 00:00:06.000
Grounded learning begins here.`;
  const cues = parseVttDocument(vtt);
  assert.equal(cues[0].speaker, 'Aksha');
  assert.equal(cues[0].startMs, 1000);
  assert.equal(cues[0].endMs, 3500);

  const parsed = await parseSourceContent({
    type: 'VTT',
    title: 'Captions',
    originalContent: vtt,
    artifactMimeType: 'text/vtt',
  });
  assert.equal(parsed.originalContent, vtt);
  assert.equal(parsed.metadata.cueCount, 2);
  assert.deepEqual(parsed.metadata.speakers, ['Aksha']);
  assert.match(parsed.rawText, /Aksha: Welcome to Lumora/);

  await assert.rejects(
    parseSourceContent({
      type: 'VTT',
      title: 'Invalid',
      originalContent: 'not webvtt',
    }),
    /WEBVTT header/,
  );
});

test('remote URL safety blocks HTTP and private network targets', async () => {
  await assert.rejects(validatePublicHttpsUrl('http://example.com'), /HTTPS/);
  await assert.rejects(validatePublicHttpsUrl('https://127.0.0.1/file'), /private/);
  assert.equal(isPrivateNetworkAddress('10.0.0.1'), true);
  assert.equal(isPrivateNetworkAddress('8.8.8.8'), false);
});

test('processing lifecycle only allows explicit transitions', () => {
  assert.doesNotThrow(() => assertValidProcessingTransition('CREATED', 'QUEUED'));
  assert.doesNotThrow(() =>
    assertValidProcessingTransition('READY_FOR_INDEXING', 'EMBEDDING'),
  );
  assert.doesNotThrow(() => assertValidProcessingTransition('PARSING', 'FAILED'));
  assert.throws(
    () => assertValidProcessingTransition('CREATED', 'COMPLETED'),
    /Invalid processing transition/,
  );
});

test('missing parser fails visibly', async () => {
  await assert.rejects(
    parseSourceContent({
      type: 'UNKNOWN' as any,
      title: 'Unsupported',
    }),
    /No parser is registered/,
  );
});

test('source validation rejects invalid files, URLs, and oversized input', () => {
  assert.equal(
    validateSourceInput({
      workspaceId: 'workspace',
      title: 'Wrong file',
      type: 'PDF',
      file: {
        size: 10,
        mimetype: 'text/plain',
        originalname: 'file.txt',
        buffer: Buffer.from('not pdf'),
      },
    }).valid,
    false,
  );
  assert.equal(
    validateSourceInput({
      workspaceId: 'workspace',
      title: 'Insecure site',
      type: 'WEBSITE',
      url: 'http://example.com',
    }).valid,
    false,
  );
  assert.match(
    validateSourceInput({
      workspaceId: 'workspace',
      title: 'Large text',
      type: 'TEXT',
      rawContent: 'a'.repeat(SOURCE_LIMITS.TEXT_BYTES + 1),
    }).error || '',
    /2 MB/,
  );
});
