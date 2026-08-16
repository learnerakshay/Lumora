import type { StoredCitation } from '../../lib/chat/conversation-store';
import type { SourceRecord } from '../../lib/source-store';
import type { ChatResponseMode } from '../../types';
import { buildYouTubeTimestampUrl } from '../../lib/ingestion/youtube-url';

export function citationsForResponse(
  responseMode: ChatResponseMode | null,
  citations: StoredCitation[] | undefined,
): StoredCitation[] {
  return responseMode === 'GENERAL' ? [] : citations || [];
}

export function citationEvidenceKey(citation: StoredCitation): string {
  return citation.id || [
    citation.sourceId,
    citation.chunkId,
    citation.page ?? '',
    citation.timestampStartMs ?? '',
  ].join(':');
}

export function findCitationEvidence(
  citation: StoredCitation,
  evidence: StoredCitation[],
): StoredCitation | undefined {
  const targetKey = citationEvidenceKey(citation);
  return evidence.find((candidate) => citationEvidenceKey(candidate) === targetKey);
}

export function sourceRefreshDisabled(loading: boolean, refreshing: boolean): boolean {
  return loading || refreshing;
}

export function canReprocessSource(source: SourceRecord): boolean {
  if (source.status === 'PENDING' || source.status === 'PROCESSING') return false;
  if (source.status === 'FAILED') return source.metadata?.retryable === true;
  return source.status === 'COMPLETED';
}

export type CitationNavigationTarget =
  | { kind: 'pdf'; href: string; source: SourceRecord }
  | { kind: 'website'; href: string; source: SourceRecord }
  | { kind: 'youtube'; href: string; source: SourceRecord }
  | { kind: 'text'; source: SourceRecord }
  | { kind: 'context'; source: SourceRecord }
  | { kind: 'unavailable' };

function externalHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function resolveCitationNavigation(
  citation: StoredCitation,
  sources: SourceRecord[],
): CitationNavigationTarget {
  const source = sources.find((candidate) => candidate.id === citation.sourceId);
  if (!source) return { kind: 'unavailable' };
  if (source.type === 'PDF') {
    const page = citation.page && citation.page > 0 ? `#page=${citation.page}` : '';
    return {
      kind: 'pdf',
      source,
      href: `/api/workspaces/${encodeURIComponent(source.workspaceId)}/sources/${encodeURIComponent(source.id)}/content${page}`,
    };
  }
  if (source.type === 'WEBSITE') {
    const href = externalHttpUrl(citation.url || source.url || source.metadata?.url);
    return href ? { kind: 'website', href, source } : { kind: 'context', source };
  }
  if (source.type === 'YOUTUBE') {
    const versionSafeUrl = citation.url || (
      citation.sourceVersion === source.currentVersion
        ? source.url || source.metadata?.url
        : null
    );
    const href = buildYouTubeTimestampUrl(versionSafeUrl, citation.timestampStartMs);
    return href ? { kind: 'youtube', href, source } : { kind: 'context', source };
  }
  if (source.type === 'TEXT') return { kind: 'text', source };
  return { kind: 'context', source };
}

export function formatCitationTimestamp(timestampMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function availableCitations(
  citations: StoredCitation[],
  sources: SourceRecord[],
): StoredCitation[] {
  const availableSourceIds = new Set(sources.map(({ id }) => id));
  return citations.filter(({ sourceId }) => availableSourceIds.has(sourceId));
}

export interface SubmissionGate {
  current: boolean;
}

export function tryBeginSubmission(gate: SubmissionGate): boolean {
  if (gate.current) return false;
  gate.current = true;
  return true;
}

export function releaseSubmission(gate: SubmissionGate): void {
  gate.current = false;
}
