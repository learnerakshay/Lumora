import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTRACTION_CONTRACT_VERSION, type ExtractedProfile } from '../skills/types';
import { normalizeExtractedProfile } from '../skills/normalize';
import { selectTargetRoles } from '../skills/role-matching';
import { analyzeSkillGaps } from '../skills/gap-analysis';
import { deriveCompetency } from './competency';
import { buildClosurePlan, isClaimedSkillGap } from './closure-plan';

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

function runPipeline(profile: ExtractedProfile) {
  const skills = normalizeExtractedProfile(profile);
  const roles = selectTargetRoles(skills);
  return analyzeSkillGaps(profile, skills, roles);
}

test('a technical gap with no observed evidence starts from fundamentals', () => {
  const report = runPipeline(baseProfile({}));
  const reactGap = report.gaps.find(
    (gap) => gap.roleId === 'frontend-react-engineer' && gap.ruleId === 'TECHNICAL_SKILL' && gap.topic === 'react',
  )!;
  const plan = buildClosurePlan(reactGap, deriveCompetency(reactGap));
  assert.match(plan[0], /fundamentals/i);
  assert.equal(plan.length, 3);
});

test('an unproven claimed skill (project-proof) gets a two-step project-anchoring plan', () => {
  const report = runPipeline(
    baseProfile({
      skills: [{ id: 'skill-0', label: 'React', category: 'framework', context: 'SKILLS_SECTION' }],
    }),
  );
  const claimedGap = report.gaps.find(
    (gap) => gap.roleId === 'frontend-react-engineer' && isClaimedSkillGap(gap) && gap.topic === 'react',
  )!;
  assert.ok(claimedGap);
  const plan = buildClosurePlan(claimedGap, deriveCompetency(claimedGap));
  assert.equal(plan.length, 2);
  assert.match(plan[0], /project/i);
});

test('a project archetype gap gets a scope-build-publish plan', () => {
  const report = runPipeline(baseProfile({}));
  const archetypeGap = report.gaps.find(
    (gap) => gap.roleId === 'frontend-react-engineer' && gap.ruleId === 'PROJECT_EVIDENCE' && gap.requiredLevel === null,
  )!;
  assert.ok(archetypeGap);
  const plan = buildClosurePlan(archetypeGap, deriveCompetency(archetypeGap));
  assert.equal(plan.length, 3);
  assert.match(plan[0], /scope/i);
  assert.match(plan[2], /publish/i);
});

test('an interview-prep gap gets a study-then-practice plan', () => {
  const report = runPipeline(baseProfile({}));
  const interviewGap = report.gaps.find(
    (gap) => gap.roleId === 'frontend-react-engineer' && gap.ruleId === 'INTERVIEW_PREP',
  )!;
  assert.ok(interviewGap);
  const plan = buildClosurePlan(interviewGap, deriveCompetency(interviewGap));
  assert.equal(plan.length, 2);
  assert.match(plan[0], /study/i);
  assert.match(plan[1], /practice/i);
});
