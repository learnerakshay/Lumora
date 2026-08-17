import type { Topic } from '../resources/domain';
import { ROLE_CATALOG } from './roles';
import { EVIDENCE_LEVEL_CREDIT, EVIDENCE_LEVEL_RANK } from './evidence';
import type {
  MatchedRequirement,
  NormalizedSkill,
  RoleDefinition,
  TargetRole,
  UnmetRequirement,
} from './types';

const CONFIDENCE_FLOOR = 0.35;
const MAX_SELECTED_ROLES = 5;
const MIN_SELECTED_ROLES = 4;
const MAX_ROLES_PER_FAMILY = 3;

function findSkillByTopic(skills: readonly NormalizedSkill[], topic: Topic): NormalizedSkill | undefined {
  return skills.find((skill) => skill.topic === topic);
}

function scoreRole(role: RoleDefinition, skills: readonly NormalizedSkill[]): TargetRole {
  let weightedSum = 0;
  let weightTotal = 0;
  const matchedRequirements: MatchedRequirement[] = [];
  const unmetRequirements: UnmetRequirement[] = [];

  for (const requirement of role.requirements) {
    weightTotal += requirement.weight;
    const skill = findSkillByTopic(skills, requirement.topic);
    const observedLevel = skill?.evidenceLevel;
    weightedSum += requirement.weight * (observedLevel ? EVIDENCE_LEVEL_CREDIT[observedLevel] : 0);

    const meetsMinimum =
      observedLevel !== undefined &&
      EVIDENCE_LEVEL_RANK[observedLevel] >= EVIDENCE_LEVEL_RANK[requirement.minEvidenceLevel];

    if (meetsMinimum && skill) {
      matchedRequirements.push({
        topic: requirement.topic,
        label: requirement.label,
        observedLevel: skill.evidenceLevel,
        evidenceRefs: skill.evidenceRefs,
      });
    } else {
      unmetRequirements.push({
        topic: requirement.topic,
        label: requirement.label,
        requiredLevel: requirement.minEvidenceLevel,
        observedLevel: observedLevel ?? 'NONE',
      });
    }
  }

  const fitScore = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 1000) / 1000 : 0;
  return {
    roleId: role.roleId,
    title: role.title,
    family: role.family,
    fitScore,
    belowConfidenceFloor: fitScore < CONFIDENCE_FLOOR,
    matchedRequirements,
    unmetRequirements,
  };
}

function shippedRequirementCount(role: TargetRole): number {
  return role.matchedRequirements.filter((requirement) => requirement.observedLevel === 'SHIPPED').length;
}

// Deterministic selection: highest fit first, ties broken by shipped-evidence
// depth, final ties broken by fixed catalog order. A family cap keeps the
// five roles from collapsing into five flavors of the same stack.
export function selectTargetRoles(skills: readonly NormalizedSkill[]): TargetRole[] {
  const catalogOrder = new Map(ROLE_CATALOG.map((role, index) => [role.roleId, index]));
  const ranked = ROLE_CATALOG.map((role) => scoreRole(role, skills)).sort((a, b) => {
    if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
    const shippedDiff = shippedRequirementCount(b) - shippedRequirementCount(a);
    if (shippedDiff !== 0) return shippedDiff;
    return (catalogOrder.get(a.roleId) ?? 0) - (catalogOrder.get(b.roleId) ?? 0);
  });

  const selected: TargetRole[] = [];
  const familyCounts = new Map<string, number>();
  for (const role of ranked) {
    if (selected.length >= MAX_SELECTED_ROLES) break;
    const count = familyCounts.get(role.family) ?? 0;
    if (count >= MAX_ROLES_PER_FAMILY) continue;
    selected.push(role);
    familyCounts.set(role.family, count + 1);
  }

  if (selected.length < MIN_SELECTED_ROLES) {
    const selectedIds = new Set(selected.map((role) => role.roleId));
    for (const role of ranked) {
      if (selected.length >= MIN_SELECTED_ROLES) break;
      if (selectedIds.has(role.roleId)) continue;
      selected.push(role);
      selectedIds.add(role.roleId);
    }
  }

  return selected;
}
