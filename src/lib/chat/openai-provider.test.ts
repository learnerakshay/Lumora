import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ChatGenerationAbortedError,
  ChatProviderError,
  generateGroundedResponse,
} from './openai-provider';

const requiredEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/lumora',
  CLERK_SECRET_KEY: 'test_secret',
  VITE_CLERK_PUBLISHABLE_KEY: 'test_publishable',
  OPENAI_API_KEY: 'test_openai_key',
  NODE_ENV: 'test',
  CHAT_REQUEST_TIMEOUT_MS: '5000',
};

function streamResponse(events: object[]): Response {
  const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function input(signal = new AbortController().signal) {
  return {
    instructions: 'Use evidence.',
    history: [],
    query: 'Question',
    userId: 'user_123',
    mode: 'DETAILED' as const,
    signal,
    onTextDelta: (_delta: string) => undefined,
  };
}

test.beforeEach(() => {
  Object.assign(process.env, requiredEnv);
});

test('streams a completed response and ignores duplicate sequence events', async () => {
  const originalFetch = globalThis.fetch;
  const deltas: string[] = [];
  let requestBody: any;
  globalThis.fetch = async (_url, request) => {
    requestBody = JSON.parse(String(request?.body));
    return streamResponse([
      { type: 'response.output_text.delta', sequence_number: 1, delta: 'Grounded ' },
      { type: 'response.output_text.delta', sequence_number: 1, delta: 'Grounded ' },
      { type: 'response.output_text.delta', sequence_number: 2, delta: '[Citation #1]' },
      {
        type: 'response.completed',
        sequence_number: 3,
        response: { id: 'resp_1', status: 'completed' },
      },
    ]);
  };
  try {
    const result = await generateGroundedResponse({
      ...input(),
      onTextDelta: (delta) => deltas.push(delta),
    });
    assert.equal(result.text, 'Grounded [Citation #1]');
    assert.deepEqual(deltas, ['Grounded ', '[Citation #1]']);
    assert.equal(result.responseId, 'resp_1');
    assert.notEqual(requestBody.safety_identifier, 'user_123');
    assert.deepEqual(requestBody.input, [{ role: 'user', content: 'Question' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('advertises registered tools and returns structured function requests', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any;
  globalThis.fetch = async (_url, request) => {
    requestBody = JSON.parse(String(request?.body));
    return streamResponse([
      {
        type: 'response.output_item.done',
        sequence_number: 1,
        item: {
          type: 'function_call',
          call_id: 'call_1',
          name: 'workspace_search',
          arguments: '{"query":"vectors"}',
        },
      },
      {
        type: 'response.completed',
        sequence_number: 2,
        response: { id: 'resp_tool', status: 'completed' },
      },
    ]);
  };
  try {
    const response = await generateGroundedResponse({
      ...input(),
      tools: [
        {
          name: 'workspace_search',
          description: 'Search this Workspace.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
            additionalProperties: false,
          },
        },
      ],
    });
    assert.equal(requestBody.tools[0].name, 'workspace_search');
    assert.deepEqual(response.toolRequests, [
      {
        id: 'call_1',
        name: 'workspace_search',
        arguments: { query: 'vectors' },
        rawArguments: '{"query":"vectors"}',
      },
    ]);
    assert.equal(response.text, '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects a stream that closes without a completion event', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    streamResponse([{ type: 'response.output_text.delta', sequence_number: 1, delta: 'partial' }]);
  try {
    await assert.rejects(
      generateGroundedResponse(input()),
      (error: unknown) =>
        error instanceof ChatProviderError && error.code === 'OPENAI_INCOMPLETE_STREAM',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('propagates caller cancellation without completing generation', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async (_url, request) =>
    new Promise<Response>((_resolve, reject) => {
      request?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  const pending = generateGroundedResponse(input(controller.signal));
  controller.abort();
  try {
    await assert.rejects(pending, ChatGenerationAbortedError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fails explicitly after retryable provider errors', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response(null, { status: 429 });
  };
  try {
    await assert.rejects(
      generateGroundedResponse(input()),
      (error: unknown) =>
        error instanceof ChatProviderError && error.code === 'OPENAI_RATE_LIMITED',
    );
    assert.equal(attempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('turns provider timeout into an explicit failure', async () => {
  const originalFetch = globalThis.fetch;
  process.env.CHAT_REQUEST_TIMEOUT_MS = '1000';
  globalThis.fetch = async (_url, request) =>
    new Promise<Response>((_resolve, reject) => {
      request?.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      );
    });
  try {
    await assert.rejects(
      generateGroundedResponse(input()),
      (error: unknown) =>
        error instanceof ChatProviderError && error.code === 'OPENAI_TIMEOUT',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
