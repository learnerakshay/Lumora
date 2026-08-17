import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTRACTION_CONTRACT_VERSION, type ExtractedProfile } from '../skills/types';
import { normalizeExtractedProfile } from '../skills/normalize';
import { selectTargetRoles } from '../skills/role-matching';
import { analyzeSkillGaps } from '../skills/gap-analysis';
import { deriveCompetency } from './competency';

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

test('technical-gap competency reads target and observed level directly from the gap', () => {
  const gaps = frontendGaps();
  const reactGap = gaps.find((gap) => gap.ruleId === 'TECHNICAL_SKILL' && gap.topic === 'react')!;
  const competency = deriveCompetency(reactGap);
  assert.equal(competency.targetLevel, 'SHIPPED');
  assert.equal(competency.observedLevel, 'NONE');
  assert.equal(competency.label, reactGap.subject);
});

test('project archetype gaps (no requiredLevel on the gap) fall back to a fixed SHIPPED target', () => {
  const gaps = frontendGaps();
  const archetypeGap = gaps.find((gap) => gap.ruleId === 'PROJECT_EVIDENCE' && gap.requiredLevel === null)!;
  assert.ok(archetypeGap);
  const competency = deriveCompetency(archetypeGap);
  assert.equal(competency.targetLevel, 'SHIPPED');
  assert.equal(competency.observedLevel, 'NONE');
});

test('interview-prep gaps fall back to a fixed MENTIONED target', () => {
  const gaps = frontendGaps();
  const interviewGap = gaps.find((gap) => gap.ruleId === 'INTERVIEW_PREP')!;
  assert.ok(interviewGap);
  const competency = deriveCompetency(interviewGap);
  assert.equal(competency.targetLevel, 'MENTIONED');
  assert.equal(competency.observedLevel, 'NONE');
});
