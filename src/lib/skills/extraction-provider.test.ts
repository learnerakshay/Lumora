import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SkillExtractionError,
  extractProfileFromResumeImage,
  extractProfileFromResumeText,
} from './extraction-provider';

const requiredEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/lumora',
  CLERK_SECRET_KEY: 'test_secret',
  VITE_CLERK_PUBLISHABLE_KEY: 'test_publishable',
  OPENAI_API_KEY: 'test_openai_key',
  NODE_ENV: 'test',
};

Object.assign(process.env, requiredEnv);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function responsesPayload(outputText: string, usage?: { input_tokens: number; output_tokens: number }) {
  return {
    output: [{ type: 'message', content: [{ type: 'output_text', text: outputText }] }],
    ...(usage ? { usage } : {}),
  };
}

const validExtraction = {
  headline: 'Frontend developer',
  yearsOfExperienceStated: 1,
  skills: [{ label: 'React', category: 'framework', context: 'SKILLS_SECTION' }],
  projects: [],
  experience: [],
  education: [],
  certifications: [],
};

test('a well-formed model response is parsed and assigned deterministic ids on the first attempt', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount += 1;
    return jsonResponse(
      responsesPayload(JSON.stringify(validExtraction), { input_tokens: 500, output_tokens: 120 }),
    );
  }) as typeof fetch;
  try {
    const result = await extractProfileFromResumeText({ resumeText: 'resume text' });
    assert.equal(callCount, 1);
    assert.equal(result.profile.skills[0]?.id, 'skill-0');
    assert.equal(result.profile.headline, 'Frontend developer');
    assert.deepEqual(result.usage, { inputTokens: 500, outputTokens: 120 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a schema-invalid response is retried once before succeeding', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount += 1;
    if (callCount === 1) {
      return jsonResponse(responsesPayload(JSON.stringify({ skills: 'not an array' })));
    }
    return jsonResponse(responsesPayload(JSON.stringify(validExtraction)));
  }) as typeof fetch;
  try {
    const result = await extractProfileFromResumeText({ resumeText: 'resume text' });
    assert.equal(callCount, 2);
    assert.equal(result.profile.skills[0]?.label, 'React');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Regression for the production failure: "Too big: expected string to have
// <=200 characters" on a valid PDF resume, caused by a legitimately long
// project name / experience title / education credential / certification
// name sharing the old 200-char bound with atomic fields.
const LEGITIMATE_LONG_TITLE =
  'AI-Powered Resume Analyzer & Skill Gap Detection Platform — a full-stack hackathon build using GPT-4 structured extraction, vector-based topic classification, and a fully deterministic real-time role-matching and gap-analysis engine for early-career developers.';

test('a legitimately long project name (>200, <=300 chars) succeeds on the first attempt without retrying', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  const extractionWithLongTitle = {
    ...validExtraction,
    projects: [
      { name: LEGITIMATE_LONG_TITLE, description: null, technologies: ['React'], hasLink: true, outcomes: [] },
    ],
  };
  globalThis.fetch = (async () => {
    callCount += 1;
    return jsonResponse(responsesPayload(JSON.stringify(extractionWithLongTitle)));
  }) as typeof fetch;
  try {
    const result = await extractProfileFromResumeText({ resumeText: 'resume text' });
    assert.equal(callCount, 1);
    assert.equal(result.profile.projects[0]?.name, LEGITIMATE_LONG_TITLE);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('schema validation failures are logged with field path, code, and configured max, never the resume content', async (t) => {
  const originalFetch = globalThis.fetch;
  const secretMarker = 'SECRET_RESUME_CONTENT_MARKER_98213';
  const overlongName = `${secretMarker} ${'x'.repeat(300)}`;
  const warnCalls: unknown[][] = [];
  t.mock.method(console, 'warn', (...args: unknown[]) => {
    warnCalls.push(args);
  });
  globalThis.fetch = (async () =>
    jsonResponse(
      responsesPayload(
        JSON.stringify({
          ...validExtraction,
          projects: [{ name: overlongName, description: null, technologies: [], hasLink: false, outcomes: [] }],
        }),
      ),
    )) as typeof fetch;
  try {
    await assert.rejects(() => extractProfileFromResumeText({ resumeText: 'resume text' }));
    const loggedText = warnCalls.map((call) => call.join(' ')).join('\n');
    assert.doesNotMatch(loggedText, new RegExp(secretMarker));
    assert.match(loggedText, /"path":"projects\.0\.name"/);
    assert.match(loggedText, /"code":"too_big"/);
    assert.match(loggedText, /"maximum":300/);
    assert.match(loggedText, /"sourceKind":"text"/);
    assert.match(loggedText, /"attempt":[01]/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a schema-invalid response on every attempt throws a typed extraction error with a stable message, never raw Zod detail', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount += 1;
    return jsonResponse(responsesPayload(JSON.stringify({ skills: 'not an array' })));
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => extractProfileFromResumeText({ resumeText: 'resume text' }),
      (error: unknown) => {
        assert.ok(error instanceof SkillExtractionError);
        assert.equal(error.code, 'EXTRACTION_SCHEMA_INVALID');
        assert.equal(error.statusCode, 422);
        assert.equal(
          error.message,
          "We couldn't reliably read this resume. Try a clearer image, PDF, or paste the resume text.",
        );
        assert.doesNotMatch(error.message, /zod|expected|received|too small|too big/i);
        return true;
      },
    );
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Regression: production returned "Too small: expected string to have >=1
// characters" for a valid JPG resume. Root cause was the OpenAI JSON schema
// declaring optional descriptive fields (project description, experience
// organization, education field/institution, certification issuer) as
// plain non-nullable strings, so the model filled unstated ones with "" and
// Zod's min(1) rejected the whole extraction. These fields must now accept
// "" or null and normalize to null without retrying or failing.
test('an empty string on an optional descriptive field normalizes to null and succeeds on the first attempt', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  const extractionWithBlankOptionalFields = {
    headline: '',
    yearsOfExperienceStated: 2,
    skills: [{ label: 'React', category: 'framework', context: 'SKILLS_SECTION' }],
    projects: [
      {
        name: 'Portfolio site',
        description: '',
        technologies: ['React'],
        hasLink: false,
        outcomes: [],
      },
    ],
    experience: [
      {
        title: 'Software Engineer',
        organization: '',
        durationMonths: 6,
        responsibilities: [],
        technologies: [],
      },
    ],
    education: [{ credential: 'B.Tech', field: '', institution: '' }],
    certifications: [{ name: 'AWS Certified', issuer: '' }],
  };
  globalThis.fetch = (async () => {
    callCount += 1;
    return jsonResponse(responsesPayload(JSON.stringify(extractionWithBlankOptionalFields)));
  }) as typeof fetch;
  try {
    const result = await extractProfileFromResumeImage({ imageBase64: 'ZmFrZQ==', imageMimeType: 'image/jpeg' });
    assert.equal(callCount, 1);
    assert.equal(result.profile.headline, null);
    assert.equal(result.profile.projects[0]?.description, null);
    assert.equal(result.profile.experience[0]?.organization, null);
    assert.equal(result.profile.education[0]?.field, null);
    assert.equal(result.profile.education[0]?.institution, null);
    assert.equal(result.profile.certifications[0]?.issuer, null);
    assert.equal(result.profile.experience[0]?.title, 'Software Engineer');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a blank filler string inside a technologies or outcomes array is dropped rather than failing the extraction', async () => {
  const extractionWithBlankArrayItems = {
    headline: 'Engineer',
    yearsOfExperienceStated: 1,
    skills: [],
    projects: [
      {
        name: 'Notes app',
        description: 'A notes app',
        technologies: ['React', '', '  '],
        hasLink: false,
        outcomes: ['', 'Shipped to 100 users'],
      },
    ],
    experience: [],
    education: [],
    certifications: [],
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    jsonResponse(responsesPayload(JSON.stringify(extractionWithBlankArrayItems)))) as typeof fetch;
  try {
    const result = await extractProfileFromResumeText({ resumeText: 'resume text' });
    assert.deepEqual(result.profile.projects[0]?.technologies, ['React']);
    assert.deepEqual(result.profile.projects[0]?.outcomes, ['Shipped to 100 users']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an empty string on an essential identifying field (skill label) still fails validation and retries, unweakened', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount += 1;
    return jsonResponse(
      responsesPayload(
        JSON.stringify({
          headline: null,
          yearsOfExperienceStated: null,
          skills: [{ label: '', category: 'framework', context: 'SKILLS_SECTION' }],
          projects: [],
          experience: [],
          education: [],
          certifications: [],
        }),
      ),
    );
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => extractProfileFromResumeText({ resumeText: 'resume text' }),
      (error: unknown) => {
        assert.ok(error instanceof SkillExtractionError);
        assert.equal(error.code, 'EXTRACTION_SCHEMA_INVALID');
        return true;
      },
    );
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a resume image is sent as inline base64 image content and parsed the same way as text', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: any = null;
  globalThis.fetch = (async (_url: unknown, init: any) => {
    capturedBody = JSON.parse(init.body);
    return jsonResponse(responsesPayload(JSON.stringify(validExtraction)));
  }) as typeof fetch;
  try {
    const result = await extractProfileFromResumeImage({ imageBase64: 'ZmFrZS1pbWFnZS1ieXRlcw==', imageMimeType: 'image/png' });
    assert.equal(result.profile.skills[0]?.label, 'React');
    const content = capturedBody.input[0].content;
    assert.equal(content[0].type, 'input_text');
    assert.equal(content[1].type, 'input_image');
    assert.equal(content[1].image_url, 'data:image/png;base64,ZmFrZS1pbWFnZS1ieXRlcw==');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an image with no legible resume content is rejected with a distinct, clear error rather than an empty profile', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  const emptyExtraction = {
    headline: null,
    yearsOfExperienceStated: null,
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
  };
  globalThis.fetch = (async () => {
    callCount += 1;
    return jsonResponse(responsesPayload(JSON.stringify(emptyExtraction)));
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => extractProfileFromResumeImage({ imageBase64: 'aW52YWxpZA==', imageMimeType: 'image/jpeg' }),
      (error: unknown) => {
        assert.ok(error instanceof SkillExtractionError);
        assert.equal(error.code, 'EXTRACTION_EMPTY_CONTENT');
        assert.equal(error.statusCode, 422);
        assert.equal(
          error.message,
          "We couldn't reliably read this resume. Try a clearer image, PDF, or paste the resume text.",
        );
        return true;
      },
    );
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a headline-only extraction is not treated as empty, for either text or image input', async () => {
  const originalFetch = globalThis.fetch;
  const headlineOnly = {
    headline: 'Just a name',
    yearsOfExperienceStated: null,
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
  };
  globalThis.fetch = (async () => jsonResponse(responsesPayload(JSON.stringify(headlineOnly)))) as typeof fetch;
  try {
    const result = await extractProfileFromResumeImage({ imageBase64: 'aW1hZ2U=', imageMimeType: 'image/webp' });
    assert.equal(result.profile.headline, 'Just a name');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a provider rejection surfaces a safe message without retrying', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount += 1;
    return jsonResponse({ error: { message: 'bad request' } }, 400);
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => extractProfileFromResumeText({ resumeText: 'resume text' }),
      (error: unknown) => {
        assert.ok(error instanceof SkillExtractionError);
        assert.equal(error.code, 'EXTRACTION_REQUEST_REJECTED');
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
    assert.equal(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
