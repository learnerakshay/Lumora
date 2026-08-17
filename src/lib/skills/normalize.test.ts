import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTRACTION_CONTRACT_VERSION, type ExtractedProfile } from './types';
import { normalizeExtractedProfile } from './normalize';

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

test('a skill listed only in the skills section is MENTIONED', () => {
  const profile = baseProfile({
    skills: [{ id: 'skill-0', label: 'React', category: 'framework', context: 'SKILLS_SECTION' }],
  });
  const [result] = normalizeExtractedProfile(profile);
  assert.equal(result.topic, 'react');
  assert.equal(result.evidenceLevel, 'MENTIONED');
  assert.deepEqual(result.evidenceRefs, [{ kind: 'SKILL', id: 'skill-0', label: 'React' }]);
});

test('a technology named in a project without a link or outcome is APPLIED', () => {
  const profile = baseProfile({
    projects: [
      {
        id: 'project-0',
        name: 'Notes app',
        description: 'A local notes app',
        technologies: ['React'],
        hasLink: false,
        outcomes: [],
      },
    ],
  });
  const [result] = normalizeExtractedProfile(profile);
  assert.equal(result.evidenceLevel, 'APPLIED');
});

test('a project with a link is SHIPPED evidence for its technologies', () => {
  const profile = baseProfile({
    projects: [
      {
        id: 'project-0',
        name: 'Deployed app',
        description: 'A deployed app',
        technologies: ['React'],
        hasLink: true,
        outcomes: [],
      },
    ],
  });
  const [result] = normalizeExtractedProfile(profile);
  assert.equal(result.evidenceLevel, 'SHIPPED');
});

test('experience under three months is APPLIED, at or above three months is SHIPPED', () => {
  const profile = baseProfile({
    experience: [
      {
        id: 'experience-0',
        title: 'Intern',
        organization: 'Acme',
        durationMonths: 1,
        responsibilities: [],
        technologies: ['Go'],
      },
      {
        id: 'experience-1',
        title: 'Engineer',
        organization: 'Acme',
        durationMonths: 3,
        responsibilities: [],
        technologies: ['Rust'],
      },
    ],
  });
  const results = normalizeExtractedProfile(profile);
  assert.equal(results.find((skill) => skill.topic === 'golang')?.evidenceLevel, 'APPLIED');
  assert.equal(results.find((skill) => skill.topic === 'rust')?.evidenceLevel, 'SHIPPED');
});

test('evidence for the same topic across skills, projects, and experience merges into one entry at the strongest level', () => {
  const profile = baseProfile({
    skills: [{ id: 'skill-0', label: 'React', category: 'framework', context: 'SKILLS_SECTION' }],
    projects: [
      {
        id: 'project-0',
        name: 'Deployed app',
        description: 'A deployed app',
        technologies: ['React'],
        hasLink: true,
        outcomes: [],
      },
    ],
  });
  const results = normalizeExtractedProfile(profile);
  assert.equal(results.length, 1);
  assert.equal(results[0].evidenceLevel, 'SHIPPED');
  assert.equal(results[0].evidenceRefs.length, 2);
});

test('an unclassified technology still produces an entry, keyed by its own label rather than a guessed topic', () => {
  const profile = baseProfile({
    skills: [{ id: 'skill-0', label: 'Photoshop', category: 'tool', context: 'SKILLS_SECTION' }],
  });
  const [result] = normalizeExtractedProfile(profile);
  assert.equal(result.topic, null);
  assert.equal(result.label, 'Photoshop');
});

test('a skill named inside project or experience prose context starts at APPLIED, not MENTIONED', () => {
  const profile = baseProfile({
    skills: [{ id: 'skill-0', label: 'Docker', category: 'tool', context: 'PROJECT' }],
  });
  const [result] = normalizeExtractedProfile(profile);
  assert.equal(result.evidenceLevel, 'APPLIED');
});
