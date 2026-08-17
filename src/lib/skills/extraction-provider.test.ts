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

test('a schema-invalid response on every attempt throws a typed extraction error rather than a fabricated profile', async () => {
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
        assert.match(error.message, /could not read/i);
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
