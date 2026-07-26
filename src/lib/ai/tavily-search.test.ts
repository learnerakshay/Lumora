import assert from 'node:assert/strict';
import test from 'node:test';
import { ToolExecutor } from './tool-executor';
import { ToolExecutionError } from './tool-errors';
import { ToolRegistry } from './tool-registry';
import {
  createTavilySearchTool,
  processTavilyResponse,
  TAVILY_TOOL_NAME,
} from './tools/tavily-search';

function context() {
  return {
    workspaceId: 'workspace_1',
    userId: 'user_1',
    requestId: 'call_1',
    signal: new AbortController().signal,
  };
}

test('processes Tavily results by validating and deduplicating provenance', () => {
  const results = processTavilyResponse(
    {
      results: [
        {
          title: 'Release notes',
          url: 'https://example.com/releases?utm_source=test#latest',
          content: 'The current stable release is available.',
          score: 0.91,
        },
        {
          title: 'Duplicate URL',
          url: 'https://example.com/releases',
          content: 'Duplicate content from the same URL.',
          score: 0.8,
        },
        {
          title: 'Invalid protocol',
          url: 'http://example.com/unsafe',
          content: 'Ignored.',
          score: 0.7,
        },
      ],
    },
    5,
  );

  assert.deepEqual(results, [
    {
      title: 'Release notes',
      url: 'https://example.com/releases',
      snippet: 'The current stable release is available.',
      score: 0.91,
    },
  ]);
});

test('Tavily tool sends a bounded request and returns structured results', async () => {
  let requestBody: any;
  let authorization = '';
  const tool = createTavilySearchTool({
    apiKey: 'tvly-test',
    maxResults: 3,
    timeoutMs: 2_000,
    fetchImpl: async (_url, init) => {
      authorization = String((init?.headers as Record<string, string>).Authorization);
      requestBody = JSON.parse(String(init?.body));
      return Response.json({
        results: [
          {
            title: 'Current documentation',
            url: 'https://docs.example.com/current',
            content: 'Current version details.',
            score: 0.9,
            published_date: '2026-07-25',
          },
        ],
      });
    },
  });

  const output = await tool.execute(
    { query: 'latest stable version', maxResults: 9, topic: 'news' },
    context(),
  );

  assert.equal(authorization, 'Bearer tvly-test');
  assert.equal(requestBody.max_results, 3);
  assert.equal(requestBody.topic, 'news');
  assert.equal(requestBody.include_answer, false);
  assert.equal(output.resultCount, 1);
  assert.equal(output.insufficient, false);
  assert.equal(output.results[0].publishedDate, '2026-07-25');
});

test('rejects malformed Tavily responses explicitly', () => {
  assert.throws(
    () => processTavilyResponse({ results: 'invalid' }, 5),
    (error: unknown) =>
      error instanceof ToolExecutionError &&
      error.code === 'TOOL_INVALID_RESPONSE',
  );
  assert.throws(
    () =>
      processTavilyResponse(
        { results: [{ title: 'Missing provenance', url: 'not-a-url' }] },
        5,
      ),
    (error: unknown) =>
      error instanceof ToolExecutionError &&
      error.code === 'TOOL_INVALID_RESPONSE',
  );
});

test('rate limits become structured tool failures after retry', async () => {
  let attempts = 0;
  const registry = new ToolRegistry();
  registry.register(
    createTavilySearchTool({
      apiKey: 'tvly-test',
      maxResults: 5,
      timeoutMs: 2_000,
      fetchImpl: async () => {
        attempts += 1;
        return new Response(null, { status: 429 });
      },
    }),
  );
  const execution = await new ToolExecutor(registry).execute(
    {
      id: 'call_1',
      name: TAVILY_TOOL_NAME,
      arguments: { query: 'latest news' },
      rawArguments: '{"query":"latest news"}',
    },
    context(),
  );

  assert.equal(attempts, 2);
  assert.equal(execution.response.status, 'failed');
  assert.equal(execution.response.error?.code, 'TOOL_RATE_LIMITED');
  assert.equal(execution.response.error?.retryable, true);
});
