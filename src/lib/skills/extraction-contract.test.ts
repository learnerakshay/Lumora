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

// Regression for the production failure: "Too small: expected string to
// have >=1 characters" when the model returned "" for optional descriptive
// fields it had nothing to state. Each of these must now parse successfully
// with the blank field normalized to null, not rejected.
test('an empty string on each optional descriptive field parses successfully and normalizes to null', () => {
  const fixtureWithBlanks = {
    headline: '',
    yearsOfExperienceStated: null,
    skills: [{ label: 'React', category: 'framework', context: 'SKILLS_SECTION' }],
    projects: [
      { name: 'Portfolio', description: '', technologies: [], hasLink: false, outcomes: [] },
    ],
    experience: [
      { title: 'Engineer', organization: '', durationMonths: null, responsibilities: [], technologies: [] },
    ],
    education: [{ credential: 'B.Tech', field: '', institution: '   ' }],
    certifications: [{ name: 'AWS Certified', issuer: '' }],
  };
  const result = parseRawExtractedProfile(fixtureWithBlanks);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.headline, null);
  assert.equal(result.data.projects[0]?.description, null);
  assert.equal(result.data.experience[0]?.organization, null);
  assert.equal(result.data.education[0]?.field, null);
  assert.equal(result.data.education[0]?.institution, null);
  assert.equal(result.data.certifications[0]?.issuer, null);
});

test('an explicit null on an optional descriptive field still parses successfully', () => {
  const fixtureWithNulls = {
    headline: null,
    yearsOfExperienceStated: null,
    skills: [],
    projects: [
      { name: 'Portfolio', description: null, technologies: [], hasLink: false, outcomes: [] },
    ],
    experience: [
      { title: 'Engineer', organization: null, durationMonths: null, responsibilities: [], technologies: [] },
    ],
    education: [{ credential: 'B.Tech', field: null, institution: null }],
    certifications: [{ name: 'AWS Certified', issuer: null }],
  };
  const result = parseRawExtractedProfile(fixtureWithNulls);
  assert.equal(result.success, true);
});

test('a blank filler string inside a technologies/outcomes/responsibilities array is dropped, not rejected', () => {
  const fixtureWithBlankArrayItems = {
    ...validFixture,
    projects: [
      {
        name: 'Portfolio',
        description: 'A portfolio site',
        technologies: ['React', '', '   ', 'Node.js'],
        hasLink: true,
        outcomes: ['', 'Live in production'],
      },
    ],
  };
  const result = parseRawExtractedProfile(fixtureWithBlankArrayItems);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.projects[0]?.technologies, ['React', 'Node.js']);
  assert.deepEqual(result.data.projects[0]?.outcomes, ['Live in production']);
});

test('essential identifying fields (skill label, project name, experience title, credential) remain required and reject an empty string', () => {
  assert.equal(
    parseRawExtractedProfile({
      ...validFixture,
      skills: [{ label: '', category: 'framework', context: 'SKILLS_SECTION' }],
    }).success,
    false,
  );
  assert.equal(
    parseRawExtractedProfile({
      ...validFixture,
      projects: [{ ...validFixture.projects[0], name: '' }],
    }).success,
    false,
  );
  assert.equal(
    parseRawExtractedProfile({
      ...validFixture,
      experience: [{ ...validFixture.experience[0], title: '' }],
    }).success,
    false,
  );
  assert.equal(
    parseRawExtractedProfile({
      ...validFixture,
      education: [{ ...validFixture.education[0], credential: '' }],
    }).success,
    false,
  );
});
