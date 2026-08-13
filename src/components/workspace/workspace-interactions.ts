import type { StoredCitation } from '../../lib/chat/conversation-store';

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
