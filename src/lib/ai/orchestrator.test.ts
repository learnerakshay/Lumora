import assert from 'node:assert/strict';
import test from 'node:test';
import type { GenerateChatInput, GenerateChatResult } from '../chat/openai-provider';
import { AIOrchestrator } from './orchestrator';
import { ToolExecutor } from './tool-executor';
import { ToolRegistry } from './tool-registry';
import { ToolExecutionError } from './tool-errors';
import { TAVILY_TOOL_NAME } from './tools/tavily-search';
import type { ToolRequest, ToolStatusUpdate } from './types';

const request: ToolRequest = {
  id: 'call_1',
  name: 'echo',
  arguments: { value: 'hello' },
  rawArguments: '{"value":"hello"}',
};

function baseInput() {
  return {
    workspaceId: 'workspace_1',
    instructions: 'Use evidence.',
    history: [],
    query: 'Question',
    userId: 'user_1',
    mode: 'DETAILED' as const,
    signal: new AbortController().signal,
    onTextDelta: (_delta: string) => undefined,
  };
}

function result(overrides: Partial<GenerateChatResult> = {}): GenerateChatResult {
  return {
    text: '',
    provider: 'openai',
    model: 'test-model',
    responseId: 'response_1',
    toolRequests: [],
    ...overrides,
  };
}

test('registry exposes model metadata without exposing execution functions', () => {
  const registry = new ToolRegistry();
  registry.register({
    name: 'echo',
    description: 'Echo a value.',
    parameters: {
      type: 'object',
      properties: { value: { type: 'string' } },
      required: ['value'],
      additionalProperties: false,
    },
    validate: (input) => input as { value: string },
    execute: async ({ value }) => ({ value }),
  });

  assert.deepEqual(registry.definitions(), [
    {
      name: 'echo',
      description: 'Echo a value.',
      parameters: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
        additionalProperties: false,
      },
    },
  ]);
  assert.throws(
    () =>
      registry.register({
        name: 'echo',
        description: 'Duplicate.',
        parameters: { type: 'object' },
        validate: (input) => input,
        execute: async () => null,
      }),
    /already registered/,
  );
});

test('executor returns structured unsupported and invalid-argument failures', async () => {
  const registry = new ToolRegistry();
  const executor = new ToolExecutor(registry);
  const context = {
    workspaceId: 'workspace_1',
    userId: 'user_1',
    signal: new AbortController().signal,
  };

  const unsupported = await executor.execute(request, context);
  assert.equal(unsupported.response.status, 'unsupported');
  assert.equal(unsupported.response.error?.code, 'TOOL_NOT_FOUND');

  registry.register({
    name: 'echo',
    description: 'Echo a value.',
    parameters: { type: 'object' },
    validate: () => {
      throw new Error('value must be a string');
    },
    execute: async () => null,
  });
  const invalid = await executor.execute(request, context);
  assert.equal(invalid.response.status, 'invalid');
  assert.equal(invalid.response.error?.code, 'INVALID_TOOL_ARGUMENTS');
});

test('executor enforces tool timeouts', async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: 'echo',
    description: 'Never completes.',
    parameters: { type: 'object' },
    timeoutMs: 100,
    validate: (input) => input,
    execute: async (_input, context) =>
      new Promise<null>((_resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        });
      }),
  });

  const execution = await new ToolExecutor(registry).execute(request, {
    workspaceId: 'workspace_1',
    userId: 'user_1',
    signal: new AbortController().signal,
  });
  assert.equal(execution.response.status, 'timed_out');
  assert.equal(execution.response.error?.code, 'TOOL_EXECUTION_TIMEOUT');
});

test('orchestrator executes registered model requests and resumes generation', async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: 'echo',
    description: 'Echo a value.',
    parameters: { type: 'object' },
    validate: (input) => input as { value: string },
    execute: async ({ value }) => ({ echoed: value }),
  });

  const calls: GenerateChatInput[] = [];
  const generate = async (input: GenerateChatInput) => {
    calls.push(input);
    if (calls.length === 1) return result({ toolRequests: [request] });
    input.onTextDelta('Final answer');
    return result({ text: 'Final answer', responseId: 'response_2' });
  };
  const statuses: ToolStatusUpdate[] = [];
  const orchestrated = await new AIOrchestrator(registry, generate).run({
    ...baseInput(),
    onToolStatus: (status) => statuses.push(status),
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].tools?.[0].name, 'echo');
  assert.equal(calls[1].toolExecutions?.[0].response.status, 'completed');
  assert.deepEqual(calls[1].toolExecutions?.[0].response.output, {
    echoed: 'hello',
  });
  assert.equal(orchestrated.text, 'Final answer');
  assert.equal(orchestrated.orchestration.toolRounds, 1);
  assert.equal(orchestrated.orchestration.intelligenceMode, 'workspace_only');
  assert.deepEqual(
    statuses.map(({ status }) => status),
    ['requested', 'running', 'completed'],
  );
});

test('tool execution reaches a terminal status before a downstream result callback can fail', async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: 'echo',
    description: 'Echo a value.',
    parameters: { type: 'object' },
    validate: (input) => input as { value: string },
    execute: async ({ value }) => ({ value }),
  });
  let generation = 0;
  const statuses: ToolStatusUpdate[] = [];
  const orchestrator = new AIOrchestrator(registry, async () => {
    generation += 1;
    return generation === 1 ? result({ toolRequests: [request] }) : result({ text: 'unused' });
  });
  await assert.rejects(
    () => orchestrator.run({
      ...baseInput(),
      onToolStatus: (status) => statuses.push(status),
      onToolResult: () => { throw new Error('optional result consumer failed'); },
    }),
    /optional result consumer failed/,
  );
  assert.deepEqual(statuses.map(({ status }) => status), ['requested', 'running', 'completed']);
});

test('invalid tool arguments terminate as invalid and orchestration continues', async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: 'echo',
    description: 'Echo a value.',
    parameters: { type: 'object' },
    validate: () => { throw new Error('invalid value'); },
    execute: async () => ({ unused: true }),
  });
  let generation = 0;
  const statuses: ToolStatusUpdate[] = [];
  const orchestrator = new AIOrchestrator(registry, async (input) => {
    generation += 1;
    if (generation === 1) return result({ toolRequests: [request] });
    assert.equal(input.toolExecutions?.[0].response.status, 'invalid');
    input.onTextDelta('Answer without tool enrichment.');
    return result({ text: 'Answer without tool enrichment.' });
  });
  const output = await orchestrator.run({ ...baseInput(), onToolStatus: (status) => statuses.push(status) });
  assert.equal(output.text, 'Answer without tool enrichment.');
  assert.deepEqual(statuses.map(({ status }) => status), ['requested', 'running', 'invalid']);
});

test('empty registry preserves the direct no-tool generation path', async () => {
  let received: GenerateChatInput | undefined;
  const generate = async (input: GenerateChatInput) => {
    received = input;
    input.onTextDelta('Grounded');
    return result({ text: 'Grounded' });
  };

  const orchestrated = await new AIOrchestrator(new ToolRegistry(), generate).run(
    baseInput(),
  );
  assert.equal(received?.tools, undefined);
  assert.equal(received?.toolExecutions, undefined);
  assert.equal(orchestrated.text, 'Grounded');
  assert.deepEqual(orchestrated.orchestration.toolExecutions, []);
});

test('AI Actions inherit each selected Mode contract without Action-specific prompt variants', async () => {
  for (const mode of ['CONCISE', 'DETAILED', 'CRITICAL', 'CREATIVE'] as const) {
    for (const action of ['SUMMARIZE', 'COMPARE']) {
      let received: GenerateChatInput | undefined;
      const orchestrator = new AIOrchestrator(
        new ToolRegistry(),
        async (input) => {
          received = input;
          input.onTextDelta('Completed action response.');
          return result({ text: 'Completed action response.' });
        },
      );
      await orchestrator.run({
        ...baseInput(),
        mode,
        instructions:
          `ACTIVE AI ACTION: ${action}. Use realistic multi-source PDF, Website, and Plain Text evidence.`,
        query: `${action} the relevant Workspace evidence.`,
      });
      assert.match(received!.instructions, new RegExp(`ACTIVE AI ACTION: ${action}`));
      assert.match(received!.instructions, new RegExp(`${mode} RESPONSE CONTRACT`, 'i'));
      assert.match(received!.instructions, /finish cleanly within the response budget/i);
    }
  }
});

test('orchestrator recognizes bounded AI action material without Workspace retrieval', async () => {
  let received: GenerateChatInput | undefined;
  const generate = async (input: GenerateChatInput) => {
    received = input;
    input.onTextDelta('Conversation summary.');
    return result({ text: 'Conversation summary.' });
  };

  await new AIOrchestrator(new ToolRegistry(), generate).run({
    ...baseInput(),
    hasWorkspaceContext: false,
    hasActionContext: true,
  });

  assert.match(received!.instructions, /validated AI Action material/);
  assert.doesNotMatch(received!.instructions, /No verified Workspace or web evidence/);
});

test('GENERAL chat explicitly allows model knowledge without claiming Workspace grounding', async () => {
  let received: GenerateChatInput | undefined;
  const generate = async (input: GenerateChatInput) => {
    received = input;
    input.onTextDelta('A general answer.');
    return result({ text: 'A general answer.' });
  };

  await new AIOrchestrator(new ToolRegistry(), generate).run({
    ...baseInput(),
    hasWorkspaceContext: false,
    allowGeneralKnowledge: true,
  });

  assert.match(received!.instructions, /Use general model knowledge/i);
  assert.match(received!.instructions, /Workspace evidence/i);
  assert.match(received!.instructions, /do not emit Workspace-style \[Citation #N\] markers/i);
});

test('orchestrator reports hybrid mode and validated Tavily sources', async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: TAVILY_TOOL_NAME,
    description: 'Search the web.',
    parameters: { type: 'object' },
    validate: (input) => input as { query: string },
    execute: async () => ({
      provider: 'tavily',
      query: 'current release',
      resultCount: 1,
      insufficient: false,
      results: [
        {
          title: 'Release notes',
          url: 'https://example.com/releases',
          snippet: 'Current release details.',
          score: 0.92,
        },
      ],
    }),
  });
  let generation = 0;
  const generate = async (input: GenerateChatInput) => {
    generation += 1;
    if (generation === 1) {
      return result({
        toolRequests: [
          {
            id: 'web_1',
            name: TAVILY_TOOL_NAME,
            arguments: { query: 'current release' },
            rawArguments: '{"query":"current release"}',
          },
        ],
      });
    }
    input.onTextDelta('Workspace evidence [Citation #1] plus web context.');
    return result({
      text: 'Workspace evidence [Citation #1] plus web context.',
    });
  };

  const orchestrated = await new AIOrchestrator(registry, generate).run({
    ...baseInput(),
    hasWorkspaceContext: true,
  });

  assert.equal(orchestrated.orchestration.intelligenceMode, 'hybrid');
  assert.equal(orchestrated.orchestration.webSearchAttempted, true);
  assert.deepEqual(orchestrated.orchestration.webSources, [
    {
      title: 'Release notes',
      url: 'https://example.com/releases',
      snippet: 'Current release details.',
      score: 0.92,
    },
  ]);
});

test('failed web search falls back to Workspace-only generation', async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: TAVILY_TOOL_NAME,
    description: 'Search the web.',
    parameters: { type: 'object' },
    validate: (input) => input,
    execute: async () => {
      throw new ToolExecutionError(
        'Web search is temporarily unavailable.',
        'TOOL_UNAVAILABLE',
        true,
      );
    },
  });
  let generation = 0;
  const generate = async (input: GenerateChatInput) => {
    generation += 1;
    if (generation === 1) {
      return result({
        toolRequests: [
          {
            id: 'web_failure',
            name: TAVILY_TOOL_NAME,
            arguments: { query: 'current release' },
            rawArguments: '{"query":"current release"}',
          },
        ],
      });
    }
    input.onTextDelta('Workspace-only answer [Citation #1].');
    return result({ text: 'Workspace-only answer [Citation #1].' });
  };

  const orchestrated = await new AIOrchestrator(registry, generate).run({
    ...baseInput(),
    hasWorkspaceContext: true,
  });

  assert.equal(orchestrated.orchestration.intelligenceMode, 'workspace_only');
  assert.equal(orchestrated.orchestration.webSearchAttempted, true);
  assert.equal(
    orchestrated.orchestration.webSearchFailure,
    'Web search is temporarily unavailable.',
  );
  assert.deepEqual(orchestrated.orchestration.webSources, []);
});

test('partial tool failures are returned to the model without breaking execution', async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: 'successful_tool',
    description: 'Returns structured data.',
    parameters: { type: 'object' },
    validate: (input) => input,
    execute: async () => ({ value: 'available' }),
  });
  registry.register({
    name: 'failing_tool',
    description: 'Fails safely.',
    parameters: { type: 'object' },
    validate: (input) => input,
    execute: async () => {
      throw new ToolExecutionError(
        'A dependency was unavailable.',
        'TOOL_UNAVAILABLE',
        true,
      );
    },
  });
  let generation = 0;
  const generate = async (input: GenerateChatInput) => {
    generation += 1;
    if (generation === 1) {
      return result({
        toolRequests: [
          {
            id: 'success_1',
            name: 'successful_tool',
            arguments: {},
            rawArguments: '{}',
          },
          {
            id: 'failure_1',
            name: 'failing_tool',
            arguments: {},
            rawArguments: '{}',
          },
        ],
      });
    }
    assert.deepEqual(
      input.toolExecutions?.map(({ response }) => response.status),
      ['completed', 'failed'],
    );
    input.onTextDelta('Graceful final response.');
    return result({ text: 'Graceful final response.' });
  };

  const orchestrated = await new AIOrchestrator(registry, generate).run(
    baseInput(),
  );
  assert.equal(orchestrated.text, 'Graceful final response.');
  assert.equal(orchestrated.orchestration.toolExecutions.length, 2);
});
