import { EVIDENCE_LEVEL_RANK } from '../skills/evidence';
import type { Gap, GapSeverity, RoleDefinition } from '../skills/types';
import type { PriorityBand, StageId } from './types';

const SEVERITY_RANK: Record<GapSeverity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const CATEGORY_ORDER: Record<Gap['category'], number> = {
  'technical-gap': 0,
  'project-proof': 1,
  'interview-prep': 2,
};

const DEFAULT_PROJECT_PROOF_WEIGHT = 2;
const DEFAULT_INTERVIEW_PREP_WEIGHT = 1;

function requirementWeight(gap: Gap, roleDef: RoleDefinition): number {
  const requirement = gap.topic ? roleDef.requirements.find((candidate) => candidate.topic === gap.topic) : undefined;
  if (requirement) return requirement.weight;
  if (gap.category === 'project-proof') return DEFAULT_PROJECT_PROOF_WEIGHT;
  if (gap.category === 'interview-prep') return DEFAULT_INTERVIEW_PREP_WEIGHT;
  return 1;
}

function evidenceShortfall(gap: Gap): number {
  if (!gap.requiredLevel) return 1;
  const requiredRank = EVIDENCE_LEVEL_RANK[gap.requiredLevel];
  const observedRank = gap.observedLevel && gap.observedLevel !== 'NONE' ? EVIDENCE_LEVEL_RANK[gap.observedLevel] : 0;
  return Math.max(1, requiredRank - observedRank);
}

export function priorityScore(gap: Gap, roleDef: RoleDefinition): number {
  return SEVERITY_RANK[gap.severity] * requirementWeight(gap, roleDef) * evidenceShortfall(gap);
}

export function bandForSeverity(severity: GapSeverity): PriorityBand {
  if (severity === 'HIGH') return 'CLOSE_NOW';
  if (severity === 'MEDIUM') return 'NEXT';
  return 'LATER';
}

export function stageIdForBand(band: PriorityBand): StageId {
  if (band === 'CLOSE_NOW') return 'now';
  if (band === 'NEXT') return 'next';
  return 'later';
}

export interface PrioritizedGap {
  gap: Gap;
  priority: number;
  band: PriorityBand;
}

// Deterministic ordering: highest score first; ties broken by a fixed
// category order, then by the gap's own stable id. The same gap set always
// produces the same order, regardless of input array order.
export function prioritizeGaps(gaps: readonly Gap[], roleDef: RoleDefinition): PrioritizedGap[] {
  return gaps
    .map((gap) => ({ gap, priority: priorityScore(gap, roleDef), band: bandForSeverity(gap.severity) }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const categoryDiff = CATEGORY_ORDER[a.gap.category] - CATEGORY_ORDER[b.gap.category];
      if (categoryDiff !== 0) return categoryDiff;
      return a.gap.id.localeCompare(b.gap.id);
    });
}
