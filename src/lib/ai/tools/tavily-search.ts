import { logger } from '../../logger';
import { ToolExecutionError } from '../tool-errors';
import type {
  ExecutionContext,
  JsonValue,
  ToolDefinition,
  WebSource,
} from '../types';

export const TAVILY_TOOL_NAME = 'tavily_search';

const TAVILY_SEARCH_ENDPOINT = 'https://api.tavily.com/search';
const MAX_QUERY_LENGTH = 2_000;
const MAX_SNIPPET_LENGTH = 4_000;
const MAX_ATTEMPTS = 2;

interface TavilySearchArguments {
  query: string;
  maxResults?: number;
  topic?: 'general' | 'news';
}

export interface TavilySearchOutput extends Record<string, JsonValue> {
  provider: 'tavily';
  query: string;
  resultCount: number;
  insufficient: boolean;
  results: Array<WebSource & Record<string, JsonValue>>;
}

interface TavilyToolConfig {
  apiKey: string;
  maxResults: number;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

function validateArguments(input: unknown): TavilySearchArguments {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Web search arguments must be an object.');
  }
  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.query !== 'string' ||
    !candidate.query.trim() ||
    candidate.query.trim().length > MAX_QUERY_LENGTH
  ) {
    throw new Error(`Web search query must contain 1-${MAX_QUERY_LENGTH} characters.`);
  }
  if (
    candidate.maxResults !== undefined &&
    (!Number.isInteger(candidate.maxResults) ||
      Number(candidate.maxResults) < 1 ||
      Number(candidate.maxResults) > 10)
  ) {
    throw new Error('Web search maxResults must be an integer between 1 and 10.');
  }
  if (
    candidate.topic !== undefined &&
    candidate.topic !== 'general' &&
    candidate.topic !== 'news'
  ) {
    throw new Error('Web search topic must be either general or news.');
  }
  const topic =
    candidate.topic === 'general' || candidate.topic === 'news'
      ? candidate.topic
      : undefined;
  return {
    query: candidate.query.trim(),
    ...(candidate.maxResults !== undefined
      ? { maxResults: Number(candidate.maxResults) }
      : {}),
    ...(topic ? { topic } : {}),
  };
}

function normalizedUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizedResult(value: unknown): WebSource | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  const url = normalizedUrl(result.url);
  const title = typeof result.title === 'string' ? result.title.trim() : '';
  const content = typeof result.content === 'string' ? result.content.trim() : '';
  const score = typeof result.score === 'number' ? result.score : Number(result.score);
  if (!url || !title || !content || !Number.isFinite(score) || score < 0 || score > 1) {
    return null;
  }
  const publishedDate =
    typeof result.published_date === 'string' && result.published_date.trim()
      ? result.published_date.trim()
      : undefined;
  return {
    title: title.slice(0, 300),
    url,
    snippet: content.slice(0, MAX_SNIPPET_LENGTH),
    score,
    ...(publishedDate ? { publishedDate } : {}),
  };
}

export function processTavilyResponse(
  payload: unknown,
  resultLimit: number,
): WebSource[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ToolExecutionError(
      'Tavily returned an invalid response.',
      'TOOL_INVALID_RESPONSE',
    );
  }
  const rawResults = (payload as Record<string, unknown>).results;
  if (!Array.isArray(rawResults)) {
    throw new ToolExecutionError(
      'Tavily returned an invalid results collection.',
      'TOOL_INVALID_RESPONSE',
    );
  }

  const seenUrls = new Set<string>();
  const seenPassages = new Set<string>();
  const results: WebSource[] = [];
  for (const rawResult of rawResults) {
    const result = normalizedResult(rawResult);
    if (!result) continue;
    const passageKey = result.snippet.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenUrls.has(result.url) || seenPassages.has(passageKey)) continue;
    seenUrls.add(result.url);
    seenPassages.add(passageKey);
    results.push(result);
    if (results.length === resultLimit) break;
  }
  if (rawResults.length > 0 && results.length === 0) {
    throw new ToolExecutionError(
      'Tavily returned results without valid source provenance.',
      'TOOL_INVALID_RESPONSE',
    );
  }
  return results;
}

function safeApiError(status: number): ToolExecutionError {
  if (status === 429) {
    return new ToolExecutionError(
      'Web search is temporarily rate limited.',
      'TOOL_RATE_LIMITED',
      true,
    );
  }
  if (status === 401 || status === 403) {
    return new ToolExecutionError(
      'Web search is not configured correctly.',
      'TOOL_CONFIGURATION_ERROR',
    );
  }
  return new ToolExecutionError(
    status >= 500
      ? 'Web search is temporarily unavailable.'
      : 'Web search rejected the request.',
    'TOOL_UNAVAILABLE',
    status >= 500,
  );
}

async function retryDelay(signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timeout);
      reject(new Error('Web search was cancelled.'));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, 250);
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

export function createTavilySearchTool(
  config: TavilyToolConfig,
): ToolDefinition<TavilySearchArguments, TavilySearchOutput> {
  if (!config.apiKey.trim()) {
    throw new Error('Tavily API key is required.');
  }
  if (
    !Number.isInteger(config.maxResults) ||
    config.maxResults < 1 ||
    config.maxResults > 10
  ) {
    throw new Error('Tavily result limit must be an integer between 1 and 10.');
  }
  const fetchImpl = config.fetchImpl || fetch;
  return {
    name: TAVILY_TOOL_NAME,
    description:
      'Search the public web for current, recent, or missing information. Use only when Workspace context is absent or insufficient, or the user explicitly requests up-to-date web information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A focused web search query.',
          maxLength: MAX_QUERY_LENGTH,
        },
        maxResults: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Maximum number of results requested.',
        },
        topic: {
          type: 'string',
          enum: ['general', 'news'],
          description: 'Use news only for current events or recent reporting.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    timeoutMs: config.timeoutMs,
    validate: validateArguments,
    execute: async (
      input: TavilySearchArguments,
      context: ExecutionContext,
    ): Promise<TavilySearchOutput> => {
      const startedAt = Date.now();
      const resultLimit = Math.min(input.maxResults || config.maxResults, config.maxResults);
      logger.debug('Tavily search requested', {
        workspaceId: context.workspaceId,
        requestId: context.requestId,
        queryLength: input.query.length,
        resultLimit,
        topic: input.topic || 'general',
      });

      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetchImpl(TAVILY_SEARCH_ENDPOINT, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: input.query,
              topic: input.topic || 'general',
              search_depth: 'basic',
              max_results: resultLimit,
              include_answer: false,
              include_raw_content: false,
              include_images: false,
            }),
            signal: context.signal,
          });
          if (!response.ok) {
            const apiError = safeApiError(response.status);
            if (apiError.retryable && attempt < MAX_ATTEMPTS - 1) {
              await response.body?.cancel();
              lastError = apiError;
              await retryDelay(context.signal);
              continue;
            }
            await response.body?.cancel();
            throw apiError;
          }

          let payload: unknown;
          try {
            payload = await response.json();
          } catch {
            throw new ToolExecutionError(
              'Tavily returned malformed JSON.',
              'TOOL_INVALID_RESPONSE',
            );
          }
          const results = processTavilyResponse(payload, resultLimit);
          logger.debug('Tavily search completed', {
            workspaceId: context.workspaceId,
            requestId: context.requestId,
            durationMs: Date.now() - startedAt,
            resultCount: results.length,
          });
          return {
            provider: 'tavily',
            query: input.query,
            resultCount: results.length,
            insufficient: results.length === 0,
            results: results.map((result) => ({ ...result })),
          };
        } catch (error) {
          if (context.signal.aborted || error instanceof ToolExecutionError) throw error;
          lastError = error;
          if (attempt < MAX_ATTEMPTS - 1) {
            await retryDelay(context.signal);
            continue;
          }
        }
      }

      logger.warn('Tavily search failed', {
        workspaceId: context.workspaceId,
        requestId: context.requestId,
        durationMs: Date.now() - startedAt,
        reason: lastError instanceof Error ? lastError.name : 'unknown',
      });
      throw new ToolExecutionError(
        'Web search could not be reached.',
        'TOOL_UNAVAILABLE',
        true,
      );
    },
  };
}
