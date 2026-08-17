import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTRACTION_CONTRACT_VERSION, type ExtractedProfile } from '../skills/types';
import { normalizeExtractedProfile } from '../skills/normalize';
import { selectTargetRoles } from '../skills/role-matching';
import { analyzeSkillGaps } from '../skills/gap-analysis';
import { getRoleDefinition } from '../skills/roles';
import { prioritizeGaps, priorityScore } from './priority';

function baseProfile(overrides: Partial<ExtractedProfile>): ExtractedProfile {
  return {
    schemaVersion: EXTRACTION_CONTRACT_VERSION,
    headline: null,
    yearsOfExperienceStated: null,
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
    ...overrides,
  };
}

function frontendGaps() {
  const profile = baseProfile({});
  const skills = normalizeExtractedProfile(profile);
  const roles = selectTargetRoles(skills);
  const report = analyzeSkillGaps(profile, skills, roles);
  return report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer');
}

test('ordering is stable and deterministic across repeated runs regardless of input order', () => {
  const roleDef = getRoleDefinition('frontend-react-engineer')!;
  const gaps = frontendGaps();
  const first = prioritizeGaps(gaps, roleDef);
  const shuffled = [...gaps].reverse();
  const second = prioritizeGaps(shuffled, roleDef);
  assert.deepEqual(
    first.map((entry) => entry.gap.id),
    second.map((entry) => entry.gap.id),
  );
});

test('higher severity gaps are ordered ahead of lower severity gaps', () => {
  const roleDef = getRoleDefinition('frontend-react-engineer')!;
  const gaps = frontendGaps();
  const prioritized = prioritizeGaps(gaps, roleDef);
  const highIndex = prioritized.findIndex((entry) => entry.gap.severity === 'HIGH');
  const lowIndex = prioritized.findIndex((entry) => entry.gap.severity === 'LOW');
  if (highIndex >= 0 && lowIndex >= 0) {
    assert.ok(highIndex < lowIndex, 'HIGH severity gaps must sort ahead of LOW severity gaps');
  }
});

test('band assignment maps directly and only from severity', () => {
  const roleDef = getRoleDefinition('frontend-react-engineer')!;
  const gaps = frontendGaps();
  const prioritized = prioritizeGaps(gaps, roleDef);
  for (const entry of prioritized) {
    if (entry.gap.severity === 'HIGH') assert.equal(entry.band, 'CLOSE_NOW');
    if (entry.gap.severity === 'MEDIUM') assert.equal(entry.band, 'NEXT');
    if (entry.gap.severity === 'LOW') assert.equal(entry.band, 'LATER');
  }
});

test('ties in score are broken by fixed category order, then by stable gap id', () => {
  const roleDef = getRoleDefinition('frontend-react-engineer')!;
  const gaps = frontendGaps();
  const prioritized = prioritizeGaps(gaps, roleDef);
  for (let index = 1; index < prioritized.length; index += 1) {
    const previous = prioritized[index - 1];
    const current = prioritized[index];
    if (previous.priority === current.priority) {
      const categoryOrder = { 'technical-gap': 0, 'project-proof': 1, 'interview-prep': 2 } as const;
      const previousRank = categoryOrder[previous.gap.category];
      const currentRank = categoryOrder[current.gap.category];
      assert.ok(
        previousRank < currentRank ||
          (previousRank === currentRank && previous.gap.id.localeCompare(current.gap.id) <= 0),
        `expected stable tie-break ordering between ${previous.gap.id} and ${current.gap.id}`,
      );
    }
  }
});

test('priority score scales with severity, requirement weight, and evidence shortfall', () => {
  const roleDef = getRoleDefinition('frontend-react-engineer')!;
  const gaps = frontendGaps();
  const reactGap = gaps.find((gap) => gap.topic === 'react' && gap.category === 'technical-gap')!;
  assert.ok(reactGap);
  // react requirement weight is 3, requiredLevel SHIPPED (rank 3) vs NONE (rank 0) => shortfall 3, severity HIGH => rank 3
  assert.equal(priorityScore(reactGap, roleDef), 3 * 3 * 3);
});
