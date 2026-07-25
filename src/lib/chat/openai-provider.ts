import { createHash } from 'node:crypto';
import { getServerEnv } from '../env';
import { ChatHistoryItem } from './conversation-context';

export class ChatProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 502,
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
    error?: { message?: string };
    incomplete_details?: { reason?: string };
  };
  error?: { message?: string };
}

export interface GenerateChatInput {
  instructions: string;
  history: ChatHistoryItem[];
  query: string;
  userId: string;
  mode: 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';
  signal: AbortSignal;
  onTextDelta: (delta: string) => void;
}

export interface GenerateChatResult {
  text: string;
  provider: 'openai';
  model: string;
  responseId: string;
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
  const abortForCaller = () => timeoutController.abort();
  input.signal.addEventListener('abort', abortForCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, env.CHAT_REQUEST_TIMEOUT_MS);

  const verbosity = input.mode === 'CONCISE' ? 'low' : input.mode === 'DETAILED' ? 'high' : 'medium';
  const requestBody = {
    model: env.CHAT_MODEL,
    instructions: input.instructions,
    input: [...input.history, { role: 'user', content: input.query }],
    stream: true,
    store: false,
    max_output_tokens: env.CHAT_MAX_OUTPUT_TOKENS,
    reasoning: { effort: env.CHAT_REASONING_EFFORT },
    text: { verbosity },
    safety_identifier: safeUserIdentifier(input.userId),
  };

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

    const handleEvent = (event: OpenAIStreamEvent) => {
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
      if (event.type === 'response.completed') {
        if (event.response?.status !== 'completed' || !event.response.id) {
          throw new ChatProviderError(
            'The AI provider returned an invalid completion.',
            'OPENAI_INVALID_COMPLETION',
          );
        }
        responseId = event.response.id;
        completed = true;
        return;
      }
      if (
        event.type === 'response.failed' ||
        event.type === 'response.incomplete' ||
        event.type === 'error' ||
        event.type === 'response.refusal.delta'
      ) {
        throw new ChatProviderError(
          'The AI provider did not complete the grounded response.',
          'OPENAI_GENERATION_FAILED',
        );
      }
    };

    while (!completed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const eventBlocks = buffer.split(/\r?\n\r?\n/);
      buffer = eventBlocks.pop() || '';
      for (const block of eventBlocks) {
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data || data === '[DONE]') continue;
        let parsedEvent: OpenAIStreamEvent;
        try {
          parsedEvent = JSON.parse(data) as OpenAIStreamEvent;
        } catch {
          throw new ChatProviderError(
            'The AI provider returned a malformed stream.',
            'OPENAI_MALFORMED_STREAM',
          );
        }
        handleEvent(parsedEvent);
      }
    }

    if (!completed || !responseId || !text.trim()) {
      throw new ChatProviderError(
        'The AI provider stream ended before completing.',
        'OPENAI_INCOMPLETE_STREAM',
      );
    }
    return { text, provider: 'openai', model: env.CHAT_MODEL, responseId };
  } catch (error) {
    if (timedOut) {
      throw new ChatProviderError(
        'The AI provider timed out before completing.',
        'OPENAI_TIMEOUT',
        504,
      );
    }
    if (input.signal.aborted) throw new ChatGenerationAbortedError();
    throw error;
  } finally {
    clearTimeout(timeout);
    input.signal.removeEventListener('abort', abortForCaller);
    await reader?.cancel().catch(() => undefined);
  }
}
