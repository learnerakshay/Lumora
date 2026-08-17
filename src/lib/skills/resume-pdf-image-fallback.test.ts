import assert from 'node:assert/strict';
import test from 'node:test';
import { isEmptyExtractableTextFailure, renderResumePdfPagesToImages } from './resume-pdf-image-fallback';

// Builds a minimal, valid, multi-page PDF whose content stream never draws
// text (no BT/Tj text-showing operators) — exactly reproducing the real-world
// symptom of a phone "scan to PDF" resume: pdf.js's getTextContent() finds
// zero text items, but the document itself opens and renders normally.
function buildTextlessPdf(pageCount: number): Uint8Array {
  const contentStream = '1 0 0 RG 10 10 50 50 re S';
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${3 + index} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  ];
  for (let index = 0; index < pageCount; index += 1) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents ${3 + pageCount + index} 0 R >>`,
    );
  }
  for (let index = 0; index < pageCount; index += 1) {
    objects.push(`<< /Length ${Buffer.byteLength(contentStream)} >>\nstream\n${contentStream}\nendstream`);
  }

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

test('isEmptyExtractableTextFailure recognizes only the exact "no extractable text" signature', () => {
  assert.equal(isEmptyExtractableTextFailure(new Error('PDF parsing failed: PDF contains no extractable text')), true);
  assert.equal(isEmptyExtractableTextFailure(new Error('PDF contains no extractable text')), true);
});

test('isEmptyExtractableTextFailure returns false for every other PDF failure, so those still fail immediately', () => {
  assert.equal(isEmptyExtractableTextFailure(new Error('Uploaded artifact does not contain a valid PDF signature')), false);
  assert.equal(isEmptyExtractableTextFailure(new Error('Encrypted or password-protected PDF files are not supported')), false);
  assert.equal(isEmptyExtractableTextFailure(new Error('PDF exceeds the 20 MB size limit')), false);
  assert.equal(isEmptyExtractableTextFailure(new Error('PDF artifact is missing')), false);
  assert.equal(isEmptyExtractableTextFailure('not an Error instance'), false);
  assert.equal(isEmptyExtractableTextFailure(undefined), false);
});

test('a real text-less PDF page is rendered to a genuine, non-empty PNG image', async () => {
  const pdf = buildTextlessPdf(1);
  const pages = await renderResumePdfPagesToImages(pdf);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].mimeType, 'image/png');
  const pngBytes = Buffer.from(pages[0].base64, 'base64');
  // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
  assert.equal(pngBytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(pngBytes.length > 100, 'expected a real rendered image, not a trivial/empty buffer');
});

test('a multi-page PDF within the bound renders one image per page, in order', async () => {
  const pdf = buildTextlessPdf(2);
  const pages = await renderResumePdfPagesToImages(pdf);
  assert.equal(pages.length, 2);
  assert.ok(pages.every((page) => page.mimeType === 'image/png' && page.base64.length > 0));
});

test('a PDF with excessive pages is bounded to the fallback page cap, not rendered unbounded', async () => {
  const pdf = buildTextlessPdf(9);
  const pages = await renderResumePdfPagesToImages(pdf);
  assert.ok(pages.length < 9, 'expected the render to stop at the fallback page cap');
  assert.ok(pages.length > 0);
});

test('bounding is driven by the real document page count, verified via an injected pdfjs that reports many pages', async () => {
  let getPageCalls = 0;
  const fakeCanvas = {
    getContext: () => ({}),
    toBuffer: () => Buffer.from('fake-png'),
  };
  const fakePage = {
    getViewport: () => ({ width: 100, height: 100 }),
    render: () => ({ promise: Promise.resolve() }),
  };
  const fakeDocument = {
    numPages: 50,
    getPage: async () => {
      getPageCalls += 1;
      return fakePage;
    },
    destroy: async () => undefined,
  };
  const fakePdfjs = {
    getDocument: () => ({ promise: Promise.resolve(fakeDocument) }),
  };

  const pages = await renderResumePdfPagesToImages(new Uint8Array([1, 2, 3]), {
    loadPdfjs: async () => fakePdfjs as any,
    createCanvas: () => fakeCanvas as any,
  });

  assert.ok(getPageCalls < 50, 'expected getPage to be called far fewer than 50 times for a bounded fallback');
  assert.equal(pages.length, getPageCalls);
});

test('the pdfjs document is always destroyed, even when rendering a page fails partway through', async () => {
  let destroyed = false;
  const fakeDocument = {
    numPages: 2,
    getPage: async () => {
      throw new Error('simulated render failure');
    },
    destroy: async () => {
      destroyed = true;
    },
  };
  const fakePdfjs = { getDocument: () => ({ promise: Promise.resolve(fakeDocument) }) };

  await assert.rejects(() =>
    renderResumePdfPagesToImages(new Uint8Array([1, 2, 3]), {
      loadPdfjs: async () => fakePdfjs as any,
      createCanvas: () => ({ getContext: () => ({}), toBuffer: () => Buffer.from('x') }) as any,
    }),
  );
  assert.equal(destroyed, true);
});

test('rendering that never resolves is bounded by the render timeout instead of hanging forever', async () => {
  const fakeDocument = {
    numPages: 1,
    getPage: () => new Promise(() => {}), // never resolves
    destroy: async () => undefined,
  };
  const fakePdfjs = { getDocument: () => ({ promise: Promise.resolve(fakeDocument) }) };

  await assert.rejects(
    () =>
      renderResumePdfPagesToImages(new Uint8Array([1, 2, 3]), {
        loadPdfjs: async () => fakePdfjs as any,
        createCanvas: () => ({ getContext: () => ({}), toBuffer: () => Buffer.from('x') }) as any,
        timeoutMs: 50,
      }),
    /timed out/,
  );
});
