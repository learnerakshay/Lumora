export interface SemanticChunk {
  chunkIndex: number;
  content: string;
  tokenEstimate: number;
  location: string; // e.g. "Paragraph 1", "Section 2"
}

export interface ChunkingOptions {
  targetChunkSize?: number; // Target character length (default ~1200 chars / ~300 tokens)
  overlapSize?: number; // Character overlap (default ~200 chars)
  minChunkSize?: number; // Minimum character length
}

export function generateSemanticChunks(
  cleanText: string,
  options: ChunkingOptions = {}
): SemanticChunk[] {
  if (!cleanText || !cleanText.trim()) return [];

  const targetSize = options.targetChunkSize || 1200;
  const overlap = options.overlapSize || 200;
  const minSize = options.minChunkSize || 100;

  const text = cleanText.trim();
  const chunks: SemanticChunk[] = [];

  // Split into paragraphs first to respect structural boundaries
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  let currentChunkText = '';
  let chunkIndex = 0;
  let paragraphOffset = 1;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();

    // If a single paragraph is longer than targetSize, split by sentence boundaries
    if (para.length > targetSize + 400) {
      if (currentChunkText.trim()) {
        const tokens = estimateTokenCount(currentChunkText);
        chunks.push({
          chunkIndex: chunkIndex++,
          content: currentChunkText.trim(),
          tokenEstimate: tokens,
          location: `Paragraph ${paragraphOffset}`,
        });
        // Retain overlap tail
        currentChunkText = currentChunkText.slice(-overlap);
      }

      // A negated-class prefix (`[^.!?]+`) would treat any embedded "." as a
      // required sentence boundary, including non-terminal decimal points
      // (timestamps like "00:00:00.000", version numbers like "1.2.3").
      // Since that boundary is never followed by whitespace, no match can
      // complete there and the scan silently drops everything up to the next
      // real terminator. Matching greedily-but-lazily up to a terminator that
      // IS followed by whitespace/end keeps non-terminal periods as content.
      const sentences = para.match(/[\s\S]+?[.!?]+(?=\s|$)\s*/g) || [para];
      for (const sentence of sentences) {
        if (currentChunkText.length + sentence.length > targetSize && currentChunkText.length >= minSize) {
          const tokens = estimateTokenCount(currentChunkText);
          chunks.push({
            chunkIndex: chunkIndex++,
            content: currentChunkText.trim(),
            tokenEstimate: tokens,
            location: `Paragraph ${paragraphOffset}`,
          });
          currentChunkText = currentChunkText.slice(-overlap) + sentence;
        } else {
          currentChunkText += (currentChunkText ? ' ' : '') + sentence;
        }
      }
      paragraphOffset++;
      continue;
    }

    // Standard paragraph aggregation
    if (currentChunkText.length + para.length > targetSize && currentChunkText.length >= minSize) {
      const tokens = estimateTokenCount(currentChunkText);
      chunks.push({
        chunkIndex: chunkIndex++,
        content: currentChunkText.trim(),
        tokenEstimate: tokens,
        location: `Section around paragraph ${paragraphOffset}`,
      });

      // Retain overlap from end of current chunk
      const overlapTail = currentChunkText.length > overlap ? currentChunkText.slice(-overlap) : currentChunkText;
      currentChunkText = overlapTail + '\n\n' + para;
    } else {
      currentChunkText += (currentChunkText ? '\n\n' : '') + para;
    }

    paragraphOffset++;
  }

  // Push final remaining chunk
  if (currentChunkText.trim().length > 0) {
    const tokens = estimateTokenCount(currentChunkText);
    chunks.push({
      chunkIndex: chunkIndex++,
      content: currentChunkText.trim(),
      tokenEstimate: tokens,
      location: `Section ending at paragraph ${paragraphOffset}`,
    });
  }

  return chunks;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Standard heuristic: ~4 chars per token for English text
  return Math.ceil(text.trim().length / 4);
}
