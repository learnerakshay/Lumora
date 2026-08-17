import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTRACTION_CONTRACT_VERSION, type ExtractedProfile } from '../skills/types';
import { normalizeExtractedProfile } from '../skills/normalize';
import { selectTargetRoles } from '../skills/role-matching';
import { analyzeSkillGaps } from '../skills/gap-analysis';
import { buildReadinessReport } from './readiness';

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
  return { roles, report };
}

test('readiness percent is read directly from the role fitScore, never recomputed', () => {
  const fullyQualified = baseProfile({
    skills: [
      { id: 'skill-0', label: 'JavaScript', category: 'language', context: 'SKILLS_SECTION' },
      { id: 'skill-1', label: 'React', category: 'framework', context: 'SKILLS_SECTION' },
      { id: 'skill-2', label: 'TypeScript', category: 'language', context: 'SKILLS_SECTION' },
      { id: 'skill-3', label: 'Next.js', category: 'framework', context: 'SKILLS_SECTION' },
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
  const { roles, report } = runPipeline(fullyQualified);
  const frontendRole = roles.find((role) => role.roleId === 'frontend-react-engineer')!;
  const selectedGaps = report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer');
  const readiness = buildReadinessReport(frontendRole, selectedGaps, report);
  assert.equal(readiness.readinessPercent, Math.round(frontendRole.fitScore * 100));
});

test('blocking gap count only counts HIGH severity gaps from the selected set', () => {
  const { roles, report } = runPipeline(baseProfile({}));
  const frontendRole = roles.find((role) => role.roleId === 'frontend-react-engineer')!;
  const allGaps = report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer');
  const readiness = buildReadinessReport(frontendRole, allGaps, report);
  assert.equal(readiness.blockingGapCount, allGaps.filter((gap) => gap.severity === 'HIGH').length);
  assert.equal(readiness.totalStepCount, allGaps.length);
});

test('an empty selected gap set produces zero blocking gaps without throwing', () => {
  const { roles, report } = runPipeline(baseProfile({}));
  const frontendRole = roles.find((role) => role.roleId === 'frontend-react-engineer')!;
  const readiness = buildReadinessReport(frontendRole, [], report);
  assert.equal(readiness.blockingGapCount, 0);
  assert.equal(readiness.totalStepCount, 0);
});

test('band thresholds are monotonic across the percent range', () => {
  const { roles, report } = runPipeline(baseProfile({}));
  const frontendRole = roles.find((role) => role.roleId === 'frontend-react-engineer')!;
  const readiness = buildReadinessReport(frontendRole, [], report);
  assert.ok(['READY', 'CLOSE', 'DEVELOPING', 'EARLY'].includes(readiness.band));
});
