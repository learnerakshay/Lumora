import { RAGCitation } from '../retrieval/rag-service';

const CITATION_MARKER = /\[Citation\s*#(\d+)\]/gi;
const CITATION_LIKE_MARKER = /\[Citation[^\]]*\]/gi;

function validateMarkerSyntax(responseText: string): void {
  const exactMarkers = [...responseText.matchAll(CITATION_MARKER)].map((match) =>
    match[0].toLowerCase(),
  );
  const citationLikeMarkers = [...responseText.matchAll(CITATION_LIKE_MARKER)].map(
    (match) => match[0].toLowerCase(),
  );
  if (
    exactMarkers.length !== citationLikeMarkers.length ||
    /\[Citation(?![^\]]*\])/i.test(responseText)
  ) {
    throw new Error('Response contained a malformed citation marker');
  }
}

export function citationsUsedByResponse(
  responseText: string,
  availableCitations: RAGCitation[],
): RAGCitation[] {
  validateMarkerSyntax(responseText);
  const usedIndexes: number[] = [];
  const seenIndexes = new Set<number>();

  for (const match of responseText.matchAll(CITATION_MARKER)) {
    const citationIndex = Number(match[1]);
    if (
      !Number.isInteger(citationIndex) ||
      citationIndex < 1 ||
      citationIndex > availableCitations.length
    ) {
      throw new Error(`Response referenced unavailable Citation #${match[1]}`);
    }
    if (!seenIndexes.has(citationIndex)) {
      seenIndexes.add(citationIndex);
      usedIndexes.push(citationIndex);
    }
  }

  if (usedIndexes.length === 0) {
    throw new Error('Grounded response did not reference any retrieved citation');
  }

  return usedIndexes.map((index) => availableCitations[index - 1]);
}

function validateAvailableMarkers(
  responseText: string,
  availableCitations: RAGCitation[],
): void {
  validateMarkerSyntax(responseText);
  for (const match of responseText.matchAll(CITATION_MARKER)) {
    const citationIndex = Number(match[1]);
    if (citationIndex < 1 || citationIndex > availableCitations.length) {
      throw new Error(`Response referenced unavailable Citation #${match[1]}`);
    }
  }
}

/**
 * Holds output until the first valid citation is present, then keeps any
 * unfinished bracketed marker buffered. This prevents an invalid inline
 * citation from ever reaching the client while retaining incremental SSE.
 */
export class CitationSafeStream {
  private pending = '';
  private released = false;

  constructor(
    private readonly availableCitations: RAGCitation[],
    private readonly emit: (text: string) => void,
  ) {}

  push(delta: string): void {
    this.pending += delta;
    const completeCandidate = this.pending.match(CITATION_LIKE_MARKER);
    const lastOpenBracket = this.pending.lastIndexOf('[');
    const safeEnd =
      lastOpenBracket >= 0 && !this.pending.slice(lastOpenBracket).includes(']')
        ? lastOpenBracket
        : this.pending.length;
    const safeText = this.pending.slice(0, safeEnd);

    if (!this.released) {
      if (!completeCandidate?.length) return;
      citationsUsedByResponse(safeText, this.availableCitations);
      this.released = true;
    }

    if (safeText) {
      validateAvailableMarkers(safeText, this.availableCitations);
      this.emit(safeText);
      this.pending = this.pending.slice(safeEnd);
    }
  }

  finish(fullResponse: string): void {
    citationsUsedByResponse(fullResponse, this.availableCitations);
    if (this.pending) {
      this.emit(this.pending);
      this.pending = '';
    }
  }
}
