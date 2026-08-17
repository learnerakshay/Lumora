// Skill-Intelligence-only fallback for a PDF resume that has no extractable
// text layer (typically a phone "scan to PDF" of a printed resume). This
// never touches the shared ingestion PDF parser (lib/ingestion/parsers.ts) —
// it only renders pages, locally and boundedly, so the caller can feed them
// through the existing image/vision extraction pipeline instead.

const MAX_FALLBACK_PAGES = 3;
const MAX_RENDER_DIMENSION_PX = 1600;
const RENDER_TIMEOUT_MS = 20_000;

// The exact, stable substring parsePdfSource() wraps its empty-text failure
// in (see lib/ingestion/parsers.ts: `throw new Error('PDF contains no
// extractable text')`, then re-wrapped as `PDF parsing failed: ${message}`).
// Matching only this narrow signature keeps every other PDF failure
// (corrupted, encrypted, oversized, wrong MIME, missing artifact) failing
// immediately and unchanged, exactly as before this fix.
const EMPTY_TEXT_FAILURE_SIGNATURE = 'PDF contains no extractable text';

export function isEmptyExtractableTextFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.includes(EMPTY_TEXT_FAILURE_SIGNATURE);
}

export interface RenderedResumePage {
  base64: string;
  mimeType: string;
}

interface CanvasLike {
  getContext(kind: '2d'): unknown;
  toBuffer(mime: 'image/png'): Buffer;
}

interface PdfImageFallbackDependencies {
  loadPdfjs: () => Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>;
  createCanvas: (width: number, height: number) => CanvasLike | Promise<CanvasLike>;
  timeoutMs: number;
}

async function defaultLoadPdfjs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function defaultCreateCanvas(width: number, height: number): Promise<CanvasLike> {
  const canvasModule = await import('@napi-rs/canvas');
  return canvasModule.createCanvas(width, height);
}

// Bounded, best-effort rendering of a PDF's pages to PNG images so the
// existing vision extraction pipeline can read a resume that has no text
// layer at all. Bounded on three axes so a pathological upload can never
// cause runaway processing: page count (MAX_FALLBACK_PAGES), render
// resolution (MAX_RENDER_DIMENSION_PX), and wall-clock time
// (RENDER_TIMEOUT_MS, racing the whole render loop).
export async function renderResumePdfPagesToImages(
  pdfBytes: Uint8Array,
  dependencies: Partial<PdfImageFallbackDependencies> = {},
): Promise<RenderedResumePage[]> {
  const loadPdfjs = dependencies.loadPdfjs ?? defaultLoadPdfjs;
  const createCanvas = dependencies.createCanvas ?? defaultCreateCanvas;
  const timeoutMs = dependencies.timeoutMs ?? RENDER_TIMEOUT_MS;

  const render = async (): Promise<RenderedResumePage[]> => {
    const pdfjs = await loadPdfjs();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBytes),
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const document = await loadingTask.promise;
    try {
      const pageCount = Math.min(document.numPages, MAX_FALLBACK_PAGES);
      const pages: RenderedResumePage[] = [];
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const longestSide = Math.max(baseViewport.width, baseViewport.height);
        const scale = Math.min(2, MAX_RENDER_DIMENSION_PX / longestSide) || 1;
        const viewport = page.getViewport({ scale });
        const canvas = await createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context as any, viewport }).promise;
        pages.push({ base64: canvas.toBuffer('image/png').toString('base64'), mimeType: 'image/png' });
      }
      return pages;
    } finally {
      await document.destroy();
    }
  };

  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('PDF image fallback rendering timed out')),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([render(), timeout]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}
