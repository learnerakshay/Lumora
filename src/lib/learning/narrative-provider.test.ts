import assert from 'node:assert/strict';
import test from 'node:test';
import { narrateLearningPlan } from './narrative-provider';
import type { NarrativeRequestInput } from './narrative-contract';

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

const requestInput: NarrativeRequestInput = {
  roleTitle: 'Frontend Engineer (React)',
  readinessBand: 'DEVELOPING',
  readinessPercent: 42,
  steps: [
    {
      stepId: 'step-1',
      subject: 'React',
      category: 'technical-gap',
      band: 'CLOSE_NOW',
      competencyLabel: 'React',
      targetLevel: 'SHIPPED',
      observedLevel: 'NONE',
    },
  ],
};

const validNarrative = {
  readinessSummary: 'You are building real momentum toward this role.',
  steps: [{ stepId: 'step-1', whyItMatters: 'React is core to this role.', evidenceBrief: 'Ship a real React app.' }],
};

test('a well-formed narration response is parsed and returned with usage', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    jsonResponse(responsesPayload(JSON.stringify(validNarrative), { input_tokens: 300, output_tokens: 80 }))) as typeof fetch;
  try {
    const result = await narrateLearningPlan(requestInput);
    assert.ok(result);
    assert.equal(result?.narrative.steps[0]?.stepId, 'step-1');
    assert.deepEqual(result?.usage, { inputTokens: 300, outputTokens: 80 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a network failure returns null instead of throwing', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('network down'); }) as typeof fetch;
  try {
    const result = await narrateLearningPlan(requestInput);
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a non-2xx provider response returns null instead of throwing', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('rate limited', { status: 429 })) as typeof fetch;
  try {
    const result = await narrateLearningPlan(requestInput);
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('malformed JSON output returns null instead of throwing', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonResponse(responsesPayload('not json'))) as typeof fetch;
  try {
    const result = await narrateLearningPlan(requestInput);
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('schema-invalid output returns null instead of throwing or retrying', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount += 1;
    return jsonResponse(responsesPayload(JSON.stringify({ steps: 'not an array' })));
  }) as typeof fetch;
  try {
    const result = await narrateLearningPlan(requestInput);
    assert.equal(result, null);
    assert.equal(callCount, 1, 'narration must never retry — a single attempt only, with a deterministic fallback');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an empty step list never calls the provider at all', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => { called = true; return jsonResponse(responsesPayload(JSON.stringify(validNarrative))); }) as typeof fetch;
  try {
    const result = await narrateLearningPlan({ ...requestInput, steps: [] });
    assert.equal(result, null);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the request body never includes resume-shaped free text, only the structured step input', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: string | undefined;
  globalThis.fetch = (async (_url, init) => {
    capturedBody = init?.body as string;
    return jsonResponse(responsesPayload(JSON.stringify(validNarrative)));
  }) as typeof fetch;
  try {
    await narrateLearningPlan(requestInput);
    const body = JSON.parse(capturedBody!);
    const sentInput = JSON.parse(body.input[0].content);
    assert.deepEqual(sentInput, requestInput);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
