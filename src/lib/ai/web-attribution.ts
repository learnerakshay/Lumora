import type { RAGCitation } from '../retrieval/rag-service';
import type { WebSource } from './types';

const MARKDOWN_LINK = /\[[^\]]*\]\((https:\/\/[^)\s]+)\)/gi;

function withoutCodeSamples(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, '')
    .replace(/```[\s\S]*$/g, '')
    .replace(/`[^`\r\n]*`/g, '')
    .replace(/`[^`\r\n]*$/g, '');
}

function incompleteCodeStart(value: string): number {
  let fenceStart = -1;
  let inlineStart = -1;
  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith('```', index)) {
      if (inlineStart < 0) fenceStart = fenceStart < 0 ? index : -1;
      index += 2;
      continue;
    }
    if (value[index] === '`' && fenceStart < 0) {
      inlineStart = inlineStart < 0 ? index : -1;
    }
  }
  return fenceStart >= 0 ? fenceStart : inlineStart;
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  return url.toString();
}

function markdownLabel(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([\\[\]])/g, '\\$1');
}

export function validateExternalWebLinks(
  responseText: string,
  webSources: WebSource[],
  workspaceCitations: RAGCitation[],
): void {
  const allowedUrls = new Set(
    [...webSources.map(({ url }) => url), ...workspaceCitations.flatMap(({ url }) => url ? [url] : [])]
      .map(canonicalUrl),
  );
  for (const match of withoutCodeSamples(responseText).matchAll(MARKDOWN_LINK)) {
    let linkedUrl: string;
    try {
      linkedUrl = canonicalUrl(match[1]);
    } catch {
      throw new Error('AI response contained an invalid external link.');
    }
    if (!allowedUrls.has(linkedUrl)) {
      throw new Error('AI response referenced an external URL that was not retrieved.');
    }
  }
}

export function externalWebSourcesAppendix(webSources: WebSource[]): string {
  if (webSources.length === 0) return '';
  const sources = webSources
    .map((source) => {
      const published = source.publishedDate
        ? ` — ${markdownLabel(source.publishedDate)}`
        : '';
      return `- [${markdownLabel(source.title)}](${source.url})${published}`;
    })
    .join('\n');
  return `\n\n---\n\n### External Web Sources\n\n${sources}`;
}

export class ExternalWebSafeStream {
  private pending = '';
  private readonly webSources = new Map<string, WebSource>();

  constructor(
    private readonly workspaceCitations: RAGCitation[],
    private readonly emit: (text: string) => void,
  ) {}

  addSources(sources: WebSource[]): void {
    for (const source of sources) this.webSources.set(source.url, source);
  }

  push(delta: string): void {
    this.pending += delta;
    const lastOpenBracket = this.pending.lastIndexOf('[');
    const bracketTail =
      lastOpenBracket >= 0 ? this.pending.slice(lastOpenBracket) : '';
    const closingBracket = bracketTail.indexOf(']');
    const hasIncompleteBracket = lastOpenBracket >= 0 && closingBracket < 0;
    const hasIncompleteMarkdownLink =
      closingBracket >= 0 &&
      bracketTail.slice(closingBracket + 1).startsWith('(') &&
      !bracketTail.slice(closingBracket + 2).includes(')');
    const safeEnd =
      hasIncompleteBracket || hasIncompleteMarkdownLink
        ? lastOpenBracket
        : this.pending.length;
    const codeStart = incompleteCodeStart(this.pending);
    const validatedSafeEnd =
      codeStart >= 0 ? Math.min(safeEnd, codeStart) : safeEnd;
    const safeText = this.pending.slice(0, validatedSafeEnd);
    if (!safeText) return;
    validateExternalWebLinks(
      safeText,
      [...this.webSources.values()],
      this.workspaceCitations,
    );
    this.emit(safeText);
    this.pending = this.pending.slice(validatedSafeEnd);
  }

  finish(fullResponse: string): void {
    validateExternalWebLinks(
      fullResponse,
      [...this.webSources.values()],
      this.workspaceCitations,
    );
    if (this.pending) {
      this.emit(this.pending);
      this.pending = '';
    }
  }
}
