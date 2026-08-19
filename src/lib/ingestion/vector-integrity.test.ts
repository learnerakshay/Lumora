import assert from 'node:assert/strict';
import test from 'node:test';
import { saveSourceIndex } from '../chunk-store';
import {
  EmbeddingContract,
  generateEmbeddingsBatch,
  validateEmbeddingVector,
} from './embedder';

const contract: EmbeddingContract = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  version: 'v1',
};

function validVector(seed = 1): number[] {
  const vector = new Array(1536).fill(0);
  vector[0] = seed;
  return vector;
}

function withEmbeddingEnvironment<T>(run: () => Promise<T>): Promise<T> {
  const previous = { ...process.env };
  Object.assign(process.env, {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
    CLERK_SECRET_KEY: 'test_secret',
    VITE_CLERK_PUBLISHABLE_KEY: 'test_publishable',
    OPENAI_API_KEY: 'test_openai_key',
    EMBEDDING_PROVIDER: 'openai',
    EMBEDDING_MODEL: contract.model,
    EMBEDDING_DIMENSIONS: String(contract.dimensions),
    EMBEDDING_VERSION: contract.version,
    NODE_ENV: 'test',
  });
  return run().finally(() => {
    process.env = previous;
  });
}

function embeddingResponse(vectors: number[][], status = 200): Response {
  return new Response(
    JSON.stringify({
      data: vectors.map((embedding, index) => ({ index, embedding })),
      ...(status >= 400 ? { error: { message: 'provider unavailable' } } : {}),
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

test('embedding vectors reject wrong dimensions, non-finite values, and zero vectors', () => {
  assert.throws(() => validateEmbeddingVector([1], contract), /dimensions/);
  assert.throws(
    () => validateEmbeddingVector([Number.NaN, ...new Array(1535).fill(0)], contract),
    /non-finite/,
  );
  assert.throws(
    () => validateEmbeddingVector(new Array(1536).fill(0), contract),
    /zero vector/,
  );
  assert.doesNotThrow(() => validateEmbeddingVector(validVector(), contract));
});

test('embedding generation preserves provider order and metadata', async () => {
  await withEmbeddingEnvironment(async () => {
    const requestedBodies: any[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      requestedBodies.push(JSON.parse(String(init?.body)));
      return embeddingResponse([validVector(1), validVector(2)]);
    };

    const result = await generateEmbeddingsBatch(['first', 'second'], undefined, fetchImpl);
    assert.equal(result.vectors.length, 2);
    assert.deepEqual(result.contract, contract);
    assert.equal(requestedBodies[0].model, contract.model);
    assert.equal(requestedBodies[0].dimensions, contract.dimensions);
  });
});

test('embedding provider failures and invalid vectors fail visibly', async () => {
  await withEmbeddingEnvironment(async () => {
    await assert.rejects(
      generateEmbeddingsBatch(
        ['content'],
        undefined,
        async () => embeddingResponse([], 401),
      ),
      /Embedding provider failure/,
    );
    await assert.rejects(
      generateEmbeddingsBatch(
        ['content'],
        undefined,
        async () => embeddingResponse([[1, 2, 3]]),
      ),
      /dimensions/,
    );
  });
});

test('transient embedding failures are retried', async () => {
  await withEmbeddingEnvironment(async () => {
    let attempts = 0;
    let reportedAttempts = 0;
    const result = await generateEmbeddingsBatch(
      ['content'],
      (_processed, _total, progress) => {
        reportedAttempts = progress?.attempts || 0;
      },
      async () => {
        attempts += 1;
        return attempts === 1
          ? embeddingResponse([], 429)
          : embeddingResponse([validVector()]);
      },
    );
    assert.equal(attempts, 2);
    assert.equal(reportedAttempts, 2);
    assert.equal(result.vectors.length, 1);
  });
});

interface FakeState {
  source: {
    id: string;
    workspaceId: string;
    activeIndexId: string | null;
    currentVersion: number;
    status: string;
    stage: string;
    metadata: Record<string, unknown>;
  };
  attempt: { id: string; stage: string; completedAt: Date | null };
  events: Array<{ attemptId: string; stage: string; details?: unknown }>;
  indexes: Array<{ id: string; sourceId: string; status: string }>;
  chunks: Array<{ indexId: string }>;
}

function createFakeVectorDatabase(options: { simulateInsertFailure?: boolean } = {}) {
  const state: FakeState = {
    source: {
      id: 'source-1',
      workspaceId: 'workspace-1',
      activeIndexId: 'index-old',
      currentVersion: 2,
      status: 'PROCESSING',
      stage: 'INDEXING',
      metadata: { stage: 'INDEXING' },
    },
    attempt: { id: 'attempt-2', stage: 'INDEXING', completedAt: null },
    events: [],
    indexes: [{ id: 'index-old', sourceId: 'source-1', status: 'READY' }],
    chunks: [{ indexId: 'index-old' }],
  };

  const database = {
    $queryRaw: async () => [{ extversion: '0.8.0' }],
    $transaction: async (operation: (tx: any) => Promise<any>) => {
      const snapshot = structuredClone(state);
      let insertCount = 0;
      const tx = {
        $queryRaw: async (strings: TemplateStringsArray) => {
          const sql = strings.join('');
          if (sql.includes('FROM "SourceProcessingAttempt"')) return [state.attempt];
          if (sql.includes('FROM "Source"') && sql.includes('FOR UPDATE')) return [state.source];
          if (sql.includes('COUNT(*)')) {
            const current = state.indexes.at(-1)!;
            const count = state.chunks.filter((chunk) => chunk.indexId === current.id).length;
            return [{ total: BigInt(count), valid: BigInt(count) }];
          }
          return [];
        },
        // saveSourceIndex now issues a single multi-row INSERT (built with
        // Prisma.sql/Prisma.join) instead of one statement per chunk, so a
        // real Prisma.Sql fragment shows up here as one value carrying every
        // row's columns concatenated in `.values` (10 columns per row: id,
        // sourceId, workspaceId, indexId, sourceVersion, content,
        // tokenEstimate, chunkIndex, embedding literal, createdAt). This
        // fake un-batches that back into individual chunk rows so the rest
        // of the fake (COUNT(*) verification, chunk snapshots) is unchanged.
        // A bulk INSERT is atomic in real Postgres, so `failInsertAt` now
        // simulates the whole statement failing rather than one row of many.
        $executeRaw: async (_strings: TemplateStringsArray, ...values: any[]) => {
          insertCount += 1;
          if (options.simulateInsertFailure) {
            throw new Error('simulated pgvector write failure');
          }
          const joined = values[0];
          const flatValues: any[] = joined?.values ?? values;
          const columnsPerRow = 10;
          let affected = 0;
          for (let offset = 0; offset < flatValues.length; offset += columnsPerRow) {
            const indexId = flatValues[offset + 3];
            state.chunks.push({ indexId });
            affected += 1;
          }
          return affected;
        },
        sourceIndex: {
          create: async ({ data }: any) => {
            const index = {
              id: `index-new-${state.indexes.length}`,
              sourceId: data.sourceId,
              status: data.status,
            };
            state.indexes.push(index);
            return { id: index.id };
          },
          updateMany: async ({ where, data }: any) => {
            const index = state.indexes.find(
              (item) =>
                item.id === where.id &&
                item.sourceId === where.sourceId &&
                item.status === where.status,
            );
            if (!index) return { count: 0 };
            index.status = data.status;
            return { count: 1 };
          },
          update: async ({ where, data }: any) => {
            const index = state.indexes.find((item) => item.id === where.id)!;
            index.status = data.status;
            return index;
          },
        },
        source: {
          update: async ({ data }: any) => {
            Object.assign(state.source, data);
            return state.source;
          },
        },
        sourceProcessingAttempt: {
          updateMany: async ({ where, data }: any) => {
            if (
              state.attempt.id !== where.id ||
              state.attempt.stage !== where.stage ||
              state.attempt.completedAt !== where.completedAt
            ) return { count: 0 };
            Object.assign(state.attempt, data);
            return { count: 1 };
          },
        },
        sourceProcessingEvent: {
          create: async ({ data }: any) => {
            state.events.push(data);
            return data;
          },
        },
      };
      try {
        return await operation(tx);
      } catch (error) {
        state.source = snapshot.source;
        state.attempt = snapshot.attempt;
        state.events = snapshot.events;
        state.indexes = snapshot.indexes;
        state.chunks = snapshot.chunks;
        throw error;
      }
    },
  };

  return { database, state };
}

function indexInput() {
  return {
    workspaceId: 'workspace-1',
    sourceId: 'source-1',
    sourceVersion: 2,
    chunkVersion: 'semantic-1200-200-v1',
    contract,
    chunks: [
      { content: 'one', tokenEstimate: 1, chunkIndex: 0, embedding: validVector(1) },
      { content: 'two', tokenEstimate: 1, chunkIndex: 1, embedding: validVector(2) },
    ],
  };
}

test('atomic index promotion supersedes the previous index only after validation', async () => {
  const { database, state } = createFakeVectorDatabase();
  const result = await saveSourceIndex(indexInput(), database as any);
  assert.equal(result.chunkCount, 2);
  assert.equal(state.source.activeIndexId, result.indexId);
  assert.equal(state.indexes.find((index) => index.id === 'index-old')?.status, 'SUPERSEDED');
  assert.equal(state.indexes.find((index) => index.id === result.indexId)?.status, 'READY');
});

test('pipeline index promotion atomically completes the owning attempt and source', async () => {
  const { database, state } = createFakeVectorDatabase();
  const result = await saveSourceIndex({
    ...indexInput(),
    completion: {
      pipelineStartedAt: Date.now(),
      details: { tokenCount: 2, parserVersion: 'youtube-transcript-1' },
    },
  }, database as any);
  assert.equal(state.source.activeIndexId, result.indexId);
  assert.equal(state.source.status, 'COMPLETED');
  assert.equal(state.source.stage, 'COMPLETED');
  assert.equal(state.attempt.stage, 'COMPLETED');
  assert.ok(state.attempt.completedAt instanceof Date);
  assert.deepEqual(state.events, [{
    attemptId: 'attempt-2',
    stage: 'COMPLETED',
    details: state.events[0].details,
  }]);
  assert.equal((state.source.metadata as any).indexId, result.indexId);
});

test('stale or failed attempt cannot promote a partial active index', async () => {
  const { database, state } = createFakeVectorDatabase();
  state.attempt.stage = 'FAILED';
  state.attempt.completedAt = new Date();
  await assert.rejects(
    saveSourceIndex({
      ...indexInput(),
      completion: {
        pipelineStartedAt: Date.now(),
        details: { tokenCount: 2 },
      },
    }, database as any),
    /no longer owns index promotion/,
  );
  assert.equal(state.source.activeIndexId, 'index-old');
  assert.equal(state.indexes.length, 1);
});

test('pgvector failure rolls back the new index and preserves the previous active index', async () => {
  const { database, state } = createFakeVectorDatabase({ simulateInsertFailure: true });
  await assert.rejects(
    saveSourceIndex(indexInput(), database as any),
    /simulated pgvector write failure/,
  );
  assert.equal(state.source.activeIndexId, 'index-old');
  assert.deepEqual(state.indexes, [
    { id: 'index-old', sourceId: 'source-1', status: 'READY' },
  ]);
  assert.deepEqual(state.chunks, [{ indexId: 'index-old' }]);
});

test('source version changes reject indexing before active-index replacement', async () => {
  const { database, state } = createFakeVectorDatabase();
  state.source.currentVersion = 3;
  await assert.rejects(
    saveSourceIndex(indexInput(), database as any),
    /Source version changed/,
  );
  assert.equal(state.source.activeIndexId, 'index-old');
  assert.equal(state.indexes.length, 1);
});

test('repeated indexing atomically replaces the active index each time', async () => {
  const { database, state } = createFakeVectorDatabase();
  const first = await saveSourceIndex(indexInput(), database as any);
  const second = await saveSourceIndex(indexInput(), database as any);
  assert.notEqual(first.indexId, second.indexId);
  assert.equal(state.source.activeIndexId, second.indexId);
  assert.equal(
    state.indexes.find((index) => index.id === first.indexId)?.status,
    'SUPERSEDED',
  );
  assert.equal(
    state.indexes.find((index) => index.id === second.indexId)?.status,
    'READY',
  );
});

test('missing pgvector extension fails before any index transaction starts', async () => {
  const { database, state } = createFakeVectorDatabase();
  database.$queryRaw = async () => [];
  await assert.rejects(
    saveSourceIndex(indexInput(), database as any),
    /pgvector extension is not available/,
  );
  assert.equal(state.source.activeIndexId, 'index-old');
  assert.equal(state.indexes.length, 1);
});
