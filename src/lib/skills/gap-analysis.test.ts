import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTRACTION_CONTRACT_VERSION, type ExtractedProfile } from './types';
import { normalizeExtractedProfile } from './normalize';
import { selectTargetRoles } from './role-matching';
import { analyzeSkillGaps } from './gap-analysis';

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
  const report = analyzeSkillGaps(profile, skills, roles);
  return { skills, roles, report };
}

const fullyQualifiedFrontendProfile = baseProfile({
  skills: [
    { id: 'skill-0', label: 'JavaScript', category: 'language', context: 'SKILLS_SECTION' },
    { id: 'skill-1', label: 'React', category: 'framework', context: 'SKILLS_SECTION' },
    { id: 'skill-2', label: 'TypeScript', category: 'language', context: 'SKILLS_SECTION' },
    { id: 'skill-3', label: 'Next.js', category: 'framework', context: 'SKILLS_SECTION' },
    { id: 'skill-4', label: 'Data Structures and Algorithms', category: 'concept', context: 'SKILLS_SECTION' },
    { id: 'skill-5', label: 'System Design', category: 'concept', context: 'SKILLS_SECTION' },
  ],
  projects: [
    {
      id: 'project-0',
      name: 'Portfolio App',
      description: 'A deployed portfolio application',
      technologies: ['React', 'JavaScript', 'TypeScript', 'Next.js'],
      hasLink: true,
      outcomes: ['Live on a custom domain'],
    },
  ],
});

test('a profile that fully satisfies a role at the required evidence level produces zero gaps for that role', () => {
  const { report } = runPipeline(fullyQualifiedFrontendProfile);
  const frontendGaps = report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer');
  assert.deepEqual(frontendGaps, []);
  const frontendStrengths = report.strengths.filter((strength) => strength.roleId === 'frontend-react-engineer');
  assert.equal(frontendStrengths.length, 4);
});

test('a skill listed but never used in a project or role produces a project-proof gap, not a fabricated technical gap', () => {
  const profile = baseProfile({
    skills: [
      { id: 'skill-0', label: 'React', category: 'framework', context: 'SKILLS_SECTION' },
      { id: 'skill-1', label: 'JavaScript', category: 'language', context: 'SKILLS_SECTION' },
      { id: 'skill-2', label: 'TypeScript', category: 'language', context: 'SKILLS_SECTION' },
    ],
  });
  const { report } = runPipeline(profile);
  const reactProjectGap = report.gaps.find(
    (gap) => gap.roleId === 'frontend-react-engineer' && gap.topic === 'react' && gap.category === 'project-proof',
  );
  assert.ok(reactProjectGap, 'expected a project-proof gap for an unproven React claim');
  assert.equal(reactProjectGap?.ruleId, 'PROJECT_EVIDENCE');
});

test('a role requirement with zero supporting evidence produces a technical-gap entry with severity scaled by weight', () => {
  const profile = baseProfile({});
  const { report } = runPipeline(profile);
  const reactGap = report.gaps.find((gap) => gap.roleId === 'frontend-react-engineer' && gap.topic === 'react');
  assert.ok(reactGap);
  assert.equal(reactGap?.category, 'technical-gap');
  assert.equal(reactGap?.requiredLevel, 'SHIPPED');
  assert.equal(reactGap?.observedLevel, 'NONE');
  assert.equal(reactGap?.severity, 'HIGH');
});

test('missing interview competencies produce interview-prep gaps distinct from technical gaps', () => {
  const profile = baseProfile({});
  const { report } = runPipeline(profile);
  const dsaGap = report.gaps.find((gap) => gap.roleId === 'frontend-react-engineer' && gap.topic === 'dsa');
  assert.ok(dsaGap);
  assert.equal(dsaGap?.category, 'interview-prep');
  assert.equal(dsaGap?.ruleId, 'INTERVIEW_PREP');
});

test('a certification alone can satisfy an interview-prep competency without a skill entry', () => {
  const profile = baseProfile({
    certifications: [{ id: 'certification-0', name: 'Data Structures and Algorithms', issuer: 'Coursera' }],
  });
  const { report } = runPipeline(profile);
  const dsaGap = report.gaps.find((gap) => gap.roleId === 'frontend-react-engineer' && gap.topic === 'dsa');
  assert.equal(dsaGap, undefined);
});

test('off-topic evidence for one role does not suppress gaps for a role it is irrelevant to', () => {
  const profile = baseProfile({
    skills: [{ id: 'skill-0', label: 'Kubernetes', category: 'tool', context: 'SKILLS_SECTION' }],
  });
  const { report } = runPipeline(profile);
  const reactGap = report.gaps.find((gap) => gap.roleId === 'frontend-react-engineer' && gap.topic === 'react');
  assert.ok(reactGap, 'an unrelated Kubernetes skill must not mask the missing React requirement');
});

test('the full pipeline is deterministic: identical input produces a byte-identical report on every run', () => {
  const profile = baseProfile({
    skills: [
      { id: 'skill-0', label: 'Python', category: 'language', context: 'SKILLS_SECTION' },
      { id: 'skill-1', label: 'AWS', category: 'platform', context: 'SKILLS_SECTION' },
    ],
    projects: [
      {
        id: 'project-0',
        name: 'Data pipeline',
        description: 'An ETL pipeline',
        technologies: ['Python', 'PostgreSQL'],
        hasLink: false,
        outcomes: ['Processes 10k records daily'],
      },
    ],
    experience: [
      {
        id: 'experience-0',
        title: 'Backend Intern',
        organization: 'Acme',
        durationMonths: 4,
        responsibilities: ['Built internal APIs'],
        technologies: ['Node.js', 'PostgreSQL'],
      },
    ],
  });

  const first = runPipeline(profile);
  const second = runPipeline(profile);
  assert.deepEqual(first.skills, second.skills);
  assert.deepEqual(first.roles, second.roles);
  assert.deepEqual(first.report, second.report);
});
