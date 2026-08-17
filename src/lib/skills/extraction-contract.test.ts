import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignExtractionIds,
  isEmptyRawExtraction,
  parseRawExtractedProfile,
} from './extraction-contract';

const validFixture = {
  headline: 'Backend-leaning full-stack developer',
  yearsOfExperienceStated: 2,
  skills: [
    { label: 'React', category: 'framework', context: 'SKILLS_SECTION' },
    { label: 'Node.js', category: 'framework', context: 'PROJECT' },
  ],
  projects: [
    {
      name: 'Task tracker',
      description: 'A Kanban-style task tracker with real-time sync.',
      technologies: ['React', 'Node.js'],
      hasLink: true,
      outcomes: ['Deployed to 40 active users'],
    },
  ],
  experience: [
    {
      title: 'Software Engineering Intern',
      organization: 'Acme Corp',
      durationMonths: 3,
      responsibilities: ['Built internal dashboards'],
      technologies: ['React'],
    },
  ],
  education: [{ credential: 'B.Tech', field: 'Computer Science', institution: 'State University' }],
  certifications: [],
};

test('a well-formed extraction fixture is accepted', () => {
  const result = parseRawExtractedProfile(validFixture);
  assert.equal(result.success, true);
});

test('honest omission is representable: no fields are forced when unknown', () => {
  const minimal = {
    headline: null,
    yearsOfExperienceStated: null,
    skills: [],
    projects: [],
    experience: [
      {
        title: 'Freelance developer',
        organization: 'Self-employed',
        durationMonths: null,
        responsibilities: [],
        technologies: [],
      },
    ],
    education: [],
    certifications: [],
  };
  const result = parseRawExtractedProfile(minimal);
  assert.equal(result.success, true);
});

test('an unknown skill category is rejected rather than coerced', () => {
  const invalid = {
    ...validFixture,
    skills: [{ label: 'React', category: 'expert', context: 'SKILLS_SECTION' }],
  };
  const result = parseRawExtractedProfile(invalid);
  assert.equal(result.success, false);
});

test('a missing required field is rejected', () => {
  const invalid = { ...validFixture, projects: [{ name: 'Task tracker' }] };
  const result = parseRawExtractedProfile(invalid);
  assert.equal(result.success, false);
});

test('a non-integer duration is rejected', () => {
  const invalid = {
    ...validFixture,
    experience: [{ ...validFixture.experience[0], durationMonths: 3.5 }],
  };
  const result = parseRawExtractedProfile(invalid);
  assert.equal(result.success, false);
});

test('assignExtractionIds assigns stable, unique, deterministic ids per category', () => {
  const parsed = parseRawExtractedProfile(validFixture);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  const profile = assignExtractionIds(parsed.data);
  assert.deepEqual(
    profile.skills.map((skill) => skill.id),
    ['skill-0', 'skill-1'],
  );
  assert.equal(profile.projects[0]?.id, 'project-0');
  assert.equal(profile.experience[0]?.id, 'experience-0');
  assert.equal(profile.education[0]?.id, 'education-0');
  assert.equal(profile.schemaVersion, 'skill-extraction-1');

  const reassigned = assignExtractionIds(parsed.data);
  assert.deepEqual(profile, reassigned);
});

test('isEmptyRawExtraction is true only when every field is blank', () => {
  const blank = {
    headline: null,
    yearsOfExperienceStated: null,
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
  };
  assert.equal(isEmptyRawExtraction(blank), true);
});

test('isEmptyRawExtraction is false when only a headline is present', () => {
  const headlineOnly = {
    headline: 'Just a name and nothing else legible',
    yearsOfExperienceStated: null,
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
  };
  assert.equal(isEmptyRawExtraction(headlineOnly), false);
});

test('isEmptyRawExtraction is false when a well-formed extraction has real content', () => {
  const parsed = parseRawExtractedProfile(validFixture);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(isEmptyRawExtraction(parsed.data), false);
});
