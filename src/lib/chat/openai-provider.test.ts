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

function streamResponse(events: object[], trailingDelimiter = true): Response {
  const payload = events
    .map((event, index) =>
      `data: ${JSON.stringify(event)}${
        trailingDelimiter || index < events.length - 1 ? '\n\n' : ''
      }`,
    )
    .join('');
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

test('processes a final buffered completion event without a trailing SSE delimiter', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    streamResponse(
      [
        { type: 'response.output_text.delta', sequence_number: 1, delta: 'Grounded [Citation #1]' },
        {
          type: 'response.completed',
          sequence_number: 2,
          response: { id: 'resp_buffered', status: 'completed' },
        },
      ],
      false,
    );
  try {
    const result = await generateGroundedResponse(input());
    assert.equal(result.responseId, 'resp_buffered');
    assert.equal(result.text, 'Grounded [Citation #1]');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('classifies output-token exhaustion with safe terminal diagnostics', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    streamResponse([
      { type: 'response.output_text.delta', sequence_number: 1, delta: 'Partial grounded text' },
      {
        type: 'response.incomplete',
        sequence_number: 2,
        response: {
          id: 'resp_incomplete',
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
        },
      },
    ]);
  try {
    await assert.rejects(
      generateGroundedResponse(input()),
      (error: unknown) =>
        error instanceof ChatProviderError &&
        error.code === 'OPENAI_MAX_OUTPUT_TOKENS' &&
        error.diagnostics?.eventType === 'response.incomplete' &&
        error.diagnostics.incompleteReason === 'max_output_tokens' &&
        error.diagnostics.hadText === true &&
        error.diagnostics.completionReceived === false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('partial text followed by a genuine provider failure remains a failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    streamResponse([
      { type: 'response.output_text.delta', sequence_number: 1, delta: 'Partial text' },
      {
        type: 'response.failed',
        sequence_number: 2,
        response: {
          id: 'resp_failed',
          status: 'failed',
          error: { code: 'server_error', message: 'Internal provider detail' },
        },
      },
    ]);
  try {
    await assert.rejects(
      generateGroundedResponse(input()),
      (error: unknown) =>
        error instanceof ChatProviderError &&
        error.code === 'OPENAI_RESPONSE_FAILED' &&
        error.diagnostics?.providerErrorCode === 'server_error' &&
        error.diagnostics.hadText === true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('refusal deltas are classified separately after the terminal completion', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    streamResponse([
      { type: 'response.refusal.delta', sequence_number: 1, delta: 'Unable to comply.' },
      {
        type: 'response.completed',
        sequence_number: 2,
        response: { id: 'resp_refusal', status: 'completed' },
      },
    ]);
  try {
    await assert.rejects(
      generateGroundedResponse(input()),
      (error: unknown) =>
        error instanceof ChatProviderError && error.code === 'OPENAI_REFUSAL',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('propagates caller cancellation as an abort without completing generation', async () => {
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
