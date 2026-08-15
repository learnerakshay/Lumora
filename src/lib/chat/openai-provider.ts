import { createHash } from 'node:crypto';
import { getServerEnv } from '../env';
import { logger } from '../logger';
import type {
  ModelToolDefinition,
  ToolExecutionRecord,
  ToolRequest,
} from '../ai/types';
import { ChatHistoryItem } from './conversation-context';
import { getResponseModeContract } from './response-mode-contract';

export class ChatProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 502,
    public readonly diagnostics?: {
      eventType?: string;
      responseStatus?: string;
      incompleteReason?: string;
      providerErrorCode?: string;
      providerErrorMessage?: string;
      hadText: boolean;
      completionReceived: boolean;
    },
  ) {
    super(message);
    this.name = 'ChatProviderError';
  }
}

export class ChatGenerationAbortedError extends Error {
  constructor() {
    super('Chat generation was cancelled');
    this.name = 'ChatGenerationAbortedError';
  }
}

interface OpenAIStreamEvent {
  type?: string;
  sequence_number?: number;
  delta?: string;
  response?: {
    id?: string;
    status?: string;
    error?: { code?: string; message?: string };
    incomplete_details?: { reason?: string };
    output?: OpenAIFunctionCallItem[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  };
  item?: OpenAIFunctionCallItem;
  error?: { code?: string; message?: string };
}

interface OpenAIFunctionCallItem {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
}

export interface GenerateChatInput {
  instructions: string;
  history: ChatHistoryItem[];
  query: string;
  userId: string;
  mode: 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';
  signal: AbortSignal;
  onTextDelta: (delta: string) => void;
  tools?: ModelToolDefinition[];
  toolExecutions?: ToolExecutionRecord[];
}

export interface GenerateChatResult {
  text: string;
  provider: 'openai';
  model: string;
  responseId: string;
  toolRequests: ToolRequest[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

function safeUserIdentifier(userId: string): string {
  return createHash('sha256').update(`lumora:${userId}`).digest('hex');
}

function safeProviderMessage(status: number): string {
  if (status === 429) return 'The AI provider is rate limited. Please try again shortly.';
  if (status === 401 || status === 403) return 'The AI provider configuration was rejected.';
  if (status >= 500) return 'The AI provider is temporarily unavailable.';
  return 'The AI provider rejected the generation request.';
}

async function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timeout);
      reject(new ChatGenerationAbortedError());
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

async function openResponseStream(
  body: Record<string, unknown>,
  apiKey: string,
  signal: AbortSignal,
): Promise<Response> {
  let lastStatus = 502;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (signal.aborted) throw new ChatGenerationAbortedError();
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
      if (response.ok && response.body) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().includes('text/event-stream')) {
          await response.body.cancel();
          throw new ChatProviderError(
            'The AI provider returned an invalid streaming response.',
            'OPENAI_INVALID_RESPONSE',
          );
        }
        return response;
      }
      lastStatus = response.status;
      await response.body?.cancel();
      if (response.status !== 429 && response.status < 500) {
        throw new ChatProviderError(
          safeProviderMessage(response.status),
          'OPENAI_REQUEST_REJECTED',
          response.status,
        );
      }
    } catch (error) {
      if (signal.aborted || error instanceof ChatGenerationAbortedError) {
        throw new ChatGenerationAbortedError();
      }
      if (error instanceof ChatProviderError) throw error;
      if (attempt === 2) {
        throw new ChatProviderError(
          'The AI provider could not be reached.',
          'OPENAI_NETWORK_FAILURE',
        );
      }
    }
    if (attempt < 2) await waitForRetry(300 * 2 ** attempt, signal);
  }
  throw new ChatProviderError(
    safeProviderMessage(lastStatus),
    lastStatus === 429 ? 'OPENAI_RATE_LIMITED' : 'OPENAI_UNAVAILABLE',
    lastStatus,
  );
}

export async function generateGroundedResponse(
  input: GenerateChatInput,
): Promise<GenerateChatResult> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new ChatProviderError(
      'AI response generation is not configured.',
      'OPENAI_NOT_CONFIGURED',
      503,
    );
  }

  const timeoutController = new AbortController();
  let timedOut = false;
  let providerCompleted = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const abortForCaller = () => timeoutController.abort();
  input.signal.addEventListener('abort', abortForCaller, { once: true });
  const clearProviderTimeout = () => {
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
  };
  const armProviderTimeout = () => {
    clearProviderTimeout();
    if (providerCompleted || timeoutController.signal.aborted) return;
    timeout = setTimeout(() => {
      if (providerCompleted || timeoutController.signal.aborted) return;
      timedOut = true;
      timeoutController.abort();
    }, env.CHAT_REQUEST_TIMEOUT_MS);
  };
  armProviderTimeout();

  const modeContract = getResponseModeContract(input.mode);
  const continuationInput = (input.toolExecutions || []).flatMap(({ request, response }) => [
    {
      type: 'function_call',
      call_id: request.id,
      name: request.name,
      arguments: request.rawArguments,
    },
    {
      type: 'function_call_output',
      call_id: request.id,
      output: JSON.stringify(
        response.status === 'completed'
          ? { ok: true, data: response.output }
          : { ok: false, error: response.error },
      ),
    },
  ]);
  const requestBody: Record<string, unknown> = {
    model: env.CHAT_MODEL,
    instructions: input.instructions,
    input: [
      ...input.history,
      { role: 'user', content: input.query },
      ...continuationInput,
    ],
    stream: true,
    store: false,
    max_output_tokens: modeContract.maxOutputTokens,
    reasoning: { effort: env.CHAT_REASONING_EFFORT },
    text: { verbosity: modeContract.verbosity },
    safety_identifier: safeUserIdentifier(input.userId),
  };
  if (input.tools?.length) {
    requestBody.tools = input.tools.map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await openResponseStream(
      requestBody,
      env.OPENAI_API_KEY,
      timeoutController.signal,
    );
    reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const seenSequences = new Set<number>();
    let buffer = '';
    let text = '';
    let completed = false;
    let responseId = '';
    let usage: GenerateChatResult['usage'];
    let refusalSeen = false;
    const toolRequests = new Map<string, ToolRequest>();

    const captureToolRequest = (item?: OpenAIFunctionCallItem) => {
      if (
        item?.type !== 'function_call' ||
        !item.call_id ||
        !item.name ||
        toolRequests.has(item.call_id)
      ) {
        return;
      }
      const rawArguments = item.arguments || '{}';
      let parsedArguments: unknown;
      let argumentParseError: string | undefined;
      try {
        parsedArguments = JSON.parse(rawArguments);
      } catch {
        parsedArguments = null;
        argumentParseError = 'Tool arguments were not valid JSON.';
      }
      toolRequests.set(item.call_id, {
        id: item.call_id,
        name: item.name,
        arguments: parsedArguments,
        rawArguments,
        ...(argumentParseError ? { argumentParseError } : {}),
      });
    };

    const handleEvent = (event: OpenAIStreamEvent) => {
      armProviderTimeout();
      if (
        Number.isInteger(event.sequence_number) &&
        seenSequences.has(event.sequence_number!)
      ) {
        return;
      }
      if (Number.isInteger(event.sequence_number)) {
        seenSequences.add(event.sequence_number!);
      }

      if (event.type === 'response.output_text.delta') {
        if (typeof event.delta !== 'string' || !event.delta) return;
        text += event.delta;
        input.onTextDelta(event.delta);
        return;
      }
      if (event.type === 'response.output_item.done') {
        captureToolRequest(event.item);
        return;
      }
      if (event.type === 'response.completed') {
        if (event.response?.status !== 'completed' || !event.response.id) {
          throw new ChatProviderError(
            'The AI provider returned an invalid completion.',
            'OPENAI_INVALID_COMPLETION',
          );
        }
        event.response.output?.forEach(captureToolRequest);
        if (refusalSeen) {
          throw new ChatProviderError(
            'The AI provider refused to answer this request.',
            'OPENAI_REFUSAL',
            422,
            {
              eventType: event.type,
              responseStatus: event.response.status,
              hadText: Boolean(text.trim()),
              completionReceived: true,
            },
          );
        }
        responseId = event.response.id;
        if (
          Number.isInteger(event.response.usage?.input_tokens) &&
          Number.isInteger(event.response.usage?.output_tokens)
        ) {
          usage = {
            inputTokens: event.response.usage!.input_tokens!,
            outputTokens: event.response.usage!.output_tokens!,
          };
        }
        completed = true;
        providerCompleted = true;
        timedOut = false;
        clearProviderTimeout();
        return;
      }
      if (event.type === 'response.refusal.delta') {
        refusalSeen = true;
        return;
      }
      if (event.type === 'response.incomplete') {
        const reason = event.response?.incomplete_details?.reason || 'unknown';
        const code =
          reason === 'max_output_tokens' || reason === 'max_tokens'
            ? 'OPENAI_MAX_OUTPUT_TOKENS'
            : reason === 'content_filter'
              ? 'OPENAI_CONTENT_FILTER'
              : 'OPENAI_RESPONSE_INCOMPLETE';
        const message =
          code === 'OPENAI_MAX_OUTPUT_TOKENS'
            ? 'The AI response exceeded its configured output-token budget.'
            : code === 'OPENAI_CONTENT_FILTER'
              ? 'The AI provider stopped the response for safety filtering.'
              : 'The AI provider returned an incomplete response.';
        throw new ChatProviderError(
          message,
          code,
          502,
          {
            eventType: event.type,
            responseStatus: event.response?.status,
            incompleteReason: reason,
            providerErrorCode: event.response?.error?.code,
            providerErrorMessage: event.response?.error?.message,
            hadText: Boolean(text.trim()),
            completionReceived: false,
          },
        );
      }
      if (event.type === 'response.failed' || event.type === 'error') {
        const providerError = event.response?.error || event.error;
        throw new ChatProviderError(
          event.type === 'response.failed'
            ? 'The AI provider failed while generating the response.'
            : 'The AI provider stream reported an error.',
          event.type === 'response.failed'
            ? 'OPENAI_RESPONSE_FAILED'
            : 'OPENAI_STREAM_ERROR',
          502,
          {
            eventType: event.type,
            responseStatus: event.response?.status,
            providerErrorCode: providerError?.code,
            providerErrorMessage: providerError?.message,
            hadText: Boolean(text.trim()),
            completionReceived: false,
          },
        );
      }
    };

    const processEventBlock = (block: string): void => {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data || data === '[DONE]') return;
      let parsedEvent: OpenAIStreamEvent;
      try {
        parsedEvent = JSON.parse(data) as OpenAIStreamEvent;
      } catch {
        throw new ChatProviderError(
          'The AI provider returned a malformed stream.',
          'OPENAI_MALFORMED_STREAM',
          502,
          {
            eventType: 'malformed_sse_data',
            hadText: Boolean(text.trim()),
            completionReceived: completed,
          },
        );
      }
      handleEvent(parsedEvent);
    };

    while (!completed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const eventBlocks = buffer.split(/\r?\n\r?\n/);
      buffer = eventBlocks.pop() || '';
      eventBlocks.forEach(processEventBlock);
    }
    buffer += decoder.decode();
    if (buffer.trim()) processEventBlock(buffer);

    if (!completed || !responseId || (!text.trim() && toolRequests.size === 0)) {
      throw new ChatProviderError(
        'The AI provider stream ended before completing.',
        'OPENAI_INCOMPLETE_STREAM',
      );
    }
    return {
      text,
      provider: 'openai',
      model: env.CHAT_MODEL,
      responseId,
      toolRequests: [...toolRequests.values()],
      ...(usage ? { usage } : {}),
    };
  } catch (error) {
    if (timedOut && !providerCompleted) {
      const timeoutError = new ChatProviderError(
        'The AI provider timed out before completing.',
        'OPENAI_TIMEOUT',
        504,
      );
      logger.error('Chat provider timed out', timeoutError, { userId: input.userId });
      throw timeoutError;
    }
    if (input.signal.aborted) {
      logger.warn('Chat provider stream aborted by caller', { userId: input.userId });
      throw new ChatGenerationAbortedError();
    }
    logger.error('Chat provider stream failed', error, {
      userId: input.userId,
      ...(error instanceof ChatProviderError
        ? {
            providerCode: error.code,
            ...error.diagnostics,
          }
        : {}),
    });
    throw error;
  } finally {
    clearProviderTimeout();
    input.signal.removeEventListener('abort', abortForCaller);
    await reader?.cancel().catch(() => undefined);
  }
}
