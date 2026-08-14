import { getServerEnv } from '../env';
import { IngestionFailure } from './errors';

const EMBEDDING_API_URL = 'https://api.openai.com/v1/embeddings';
const MAX_BATCH_SIZE = 64;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 30_000;

export interface EmbeddingContract {
  provider: 'openai';
  model: 'text-embedding-3-small' | 'text-embedding-3-large';
  dimensions: 1536;
  version: string;
}

export interface EmbeddingBatchResult {
  vectors: number[][];
  contract: EmbeddingContract;
  inputTokens?: number;
}

export interface EmbeddingProgress {
  processed: number;
  total: number;
  batchIndex: number;
  batchCount: number;
  attempts: number;
  durationMs: number;
}

interface OpenAIEmbeddingResponse {
  data?: Array<{ index?: number; embedding?: number[] }>;
  error?: { message?: string };
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

export function getEmbeddingContract(): EmbeddingContract {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for embedding generation');
  }
  if (env.EMBEDDING_DIMENSIONS !== 1536) {
    throw new Error(
      `Embedding dimension ${env.EMBEDDING_DIMENSIONS} is incompatible with vector(1536)`,
    );
  }

  return {
    provider: env.EMBEDDING_PROVIDER,
    model: env.EMBEDDING_MODEL,
    dimensions: 1536,
    version: env.EMBEDDING_VERSION,
  };
}

export function validateEmbeddingVector(
  value: unknown,
  contract: EmbeddingContract,
  label = 'embedding',
): asserts value is number[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is not a vector`);
  }
  if (value.length !== contract.dimensions) {
    throw new Error(
      `${label} has ${value.length} dimensions; expected ${contract.dimensions}`,
    );
  }
  if (value.some((component) => typeof component !== 'number' || !Number.isFinite(component))) {
    throw new Error(`${label} contains a non-finite numeric value`);
  }
  if (!value.some((component) => component !== 0)) {
    throw new Error(`${label} is a zero vector`);
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function retryDelay(attempt: number, retryAfter: string | null): number {
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(retryAfterSeconds * 1000, 10_000);
  }
  return Math.min(250 * 2 ** (attempt - 1), 2_000);
}

async function requestEmbeddingBatch(
  texts: string[],
  contract: EmbeddingContract,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<{ vectors: number[][]; attempts: number; inputTokens?: number }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(EMBEDDING_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: texts,
          model: contract.model,
          dimensions: contract.dimensions,
          encoding_format: 'float',
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as OpenAIEmbeddingResponse;
      if (!response.ok) {
        const message = payload.error?.message || `OpenAI embeddings returned HTTP ${response.status}`;
        if (attempt < MAX_ATTEMPTS && isRetryableStatus(response.status)) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay(attempt, response.headers.get('retry-after'))),
          );
          continue;
        }
        throw new IngestionFailure({
          message: `Embedding provider failure: ${message}`,
          errorCode: 'EMBEDDING_ERROR',
          userMessage: 'Lumora could not prepare this source for search. Please retry shortly.',
          retryable: isRetryableStatus(response.status),
          provider: 'openai',
          httpStatus: response.status,
        });
      }

      if (!Array.isArray(payload.data) || payload.data.length !== texts.length) {
        throw new Error(
          `Embedding provider returned ${payload.data?.length ?? 0} vectors for ${texts.length} inputs`,
        );
      }

      const indexed = new Map<number, { index?: number; embedding?: number[] }>();
      payload.data.forEach((item) => {
        if (
          !Number.isInteger(item.index) ||
          item.index! < 0 ||
          item.index! >= texts.length ||
          indexed.has(item.index!)
        ) {
          throw new Error('Embedding provider returned invalid or duplicate vector indexes');
        }
        indexed.set(item.index!, item);
      });
      const vectors = texts.map((_text, index) => {
        const item = indexed.get(index);
        if (!item) {
          throw new Error(`Embedding provider omitted vector index ${index}`);
        }
        validateEmbeddingVector(item.embedding, contract, `embedding ${index}`);
        return item.embedding;
      });
      const inputTokens = Number.isInteger(payload.usage?.prompt_tokens)
        ? payload.usage!.prompt_tokens
        : Number.isInteger(payload.usage?.total_tokens)
          ? payload.usage!.total_tokens
          : undefined;
      return { vectors, attempts: attempt, inputTokens };
    } catch (error) {
      const retryableNetworkFailure =
        error instanceof TypeError ||
        (error instanceof DOMException && error.name === 'AbortError');
      if (attempt < MAX_ATTEMPTS && retryableNetworkFailure) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt, null)));
        continue;
      }
      if (retryableNetworkFailure) {
        throw new IngestionFailure({
          message:
            error instanceof DOMException && error.name === 'AbortError'
              ? 'Embedding provider request timed out'
              : 'Embedding provider network request failed',
          errorCode: 'EMBEDDING_ERROR',
          userMessage: 'Lumora could not prepare this source for search. Please retry shortly.',
          retryable: true,
          provider: 'openai',
          cause: error,
        });
      }
      if (error instanceof Error) throw error;
      throw new Error('Embedding provider failed with an unknown error');
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Embedding provider exhausted all retry attempts');
}

export async function generateEmbeddingsBatch(
  texts: string[],
  onProgress?: (
    processed: number,
    total: number,
    progress?: EmbeddingProgress,
  ) => void | Promise<void>,
  fetchImpl: typeof fetch = fetch,
): Promise<EmbeddingBatchResult> {
  if (texts.length === 0) {
    throw new Error('Embedding generation requires at least one input');
  }
  if (texts.some((text) => typeof text !== 'string' || text.trim().length === 0)) {
    throw new Error('Embedding generation received an empty input');
  }

  const env = getServerEnv();
  const contract = getEmbeddingContract();
  const vectors: number[][] = [];
  let inputTokens = 0;
  let hasCompleteUsage = true;
  const batchCount = Math.ceil(texts.length / MAX_BATCH_SIZE);

  for (let offset = 0; offset < texts.length; offset += MAX_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + MAX_BATCH_SIZE);
    const startedAt = Date.now();
    const result = await requestEmbeddingBatch(
      batch,
      contract,
      env.OPENAI_API_KEY!,
      fetchImpl,
    );
    vectors.push(...result.vectors);
    if (result.inputTokens === undefined) {
      hasCompleteUsage = false;
    } else {
      inputTokens += result.inputTokens;
    }
    await onProgress?.(vectors.length, texts.length, {
      processed: vectors.length,
      total: texts.length,
      batchIndex: Math.floor(offset / MAX_BATCH_SIZE) + 1,
      batchCount,
      attempts: result.attempts,
      durationMs: Date.now() - startedAt,
    });
  }

  return {
    vectors,
    contract,
    ...(hasCompleteUsage ? { inputTokens } : {}),
  };
}
