import type { EvidenceLevel } from './types';

export const EVIDENCE_LEVEL_RANK: Record<EvidenceLevel, number> = {
  MENTIONED: 1,
  APPLIED: 2,
  SHIPPED: 3,
};

export const EVIDENCE_LEVEL_CREDIT: Record<EvidenceLevel, number> = {
  MENTIONED: 0.35,
  APPLIED: 0.75,
  SHIPPED: 1,
};

export function maxEvidenceLevel(a: EvidenceLevel, b: EvidenceLevel): EvidenceLevel {
  return EVIDENCE_LEVEL_RANK[b] > EVIDENCE_LEVEL_RANK[a] ? b : a;
}
