import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTRACTION_CONTRACT_VERSION, type ExtractedProfile } from '../skills/types';
import { normalizeExtractedProfile } from '../skills/normalize';
import { selectTargetRoles } from '../skills/role-matching';
import { analyzeSkillGaps } from '../skills/gap-analysis';
import { getRoleDefinition } from '../skills/roles';
import { isClaimedSkillGap } from './closure-plan';
import { buildEvidenceTask } from './evidence-task';

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

const roleDef = getRoleDefinition('frontend-react-engineer')!;

test('a project archetype task pulls its signature topics from the role catalog, not the gap', () => {
  const report = runPipeline(baseProfile({}));
  const archetypeGap = report.gaps.find(
    (gap) => gap.roleId === 'frontend-react-engineer' && gap.ruleId === 'PROJECT_EVIDENCE' && gap.requiredLevel === null,
  )!;
  const task = buildEvidenceTask(archetypeGap, roleDef);
  const archetype = roleDef.projectArchetypes.find((candidate) => candidate.label === archetypeGap.subject)!;
  assert.deepEqual(task.signatureTopics, archetype.signatureTopics);
  assert.ok(task.acceptanceCriteria.some((criterion) => criterion.includes('deployed')));
});

test('a technical-gap task requires the gap topic as a core implementation criterion', () => {
  const report = runPipeline(baseProfile({}));
  const reactGap = report.gaps.find(
    (gap) => gap.roleId === 'frontend-react-engineer' && gap.ruleId === 'TECHNICAL_SKILL' && gap.topic === 'react',
  )!;
  const task = buildEvidenceTask(reactGap, roleDef);
  assert.deepEqual(task.signatureTopics, ['react']);
  assert.match(task.title, /React/);
});

test('an interview-prep task never claims deployment or a repository', () => {
  const report = runPipeline(baseProfile({}));
  const interviewGap = report.gaps.find(
    (gap) => gap.roleId === 'frontend-react-engineer' && gap.ruleId === 'INTERVIEW_PREP',
  )!;
  const task = buildEvidenceTask(interviewGap, roleDef);
  assert.ok(task.acceptanceCriteria.every((criterion) => !/deployed|repository/i.test(criterion)));
});

test('a claimed-skill project-proof task is distinguished from an archetype task', () => {
  const report = runPipeline(
    baseProfile({
      skills: [{ id: 'skill-0', label: 'React', category: 'framework', context: 'SKILLS_SECTION' }],
    }),
  );
  const claimedGap = report.gaps.find(
    (gap) => gap.roleId === 'frontend-react-engineer' && isClaimedSkillGap(gap) && gap.topic === 'react',
  )!;
  const task = buildEvidenceTask(claimedGap, roleDef);
  assert.deepEqual(task.signatureTopics, ['react']);
  assert.match(task.title, /React/);
});
