import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRAGContext,
  createCitation,
  rankAndDeduplicateChunks,
  RetrievedChunk,
  searchWorkspaceChunks,
} from './rag-service';

const contract = {
  provider: 'openai' as const,
  model: 'text-embedding-3-small' as const,
  dimensions: 1536 as const,
  version: 'v1',
};

function vector(): number[] {
  return [1, ...new Array(1535).fill(0)];
}

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: 'chunk-1',
    sourceId: 'source-1',
    workspaceId: 'workspace-1',
    indexId: 'index-1',
    sourceVersion: 2,
    content: 'Grounded Lumora research passage with unique production facts.',
    tokenCount: 20,
    chunkIndex: 0,
    similarity: 0.9,
    sourceTitle: 'Lumora Research',
    sourceType: 'TEXT',
    sourceUrl: null,
    parserMetadata: { sourceType: 'TEXT' },
    sourceCleanText: 'Grounded Lumora research passage with unique production facts.',
    ...overrides,
  };
}

function rawRow(overrides: Record<string, unknown> = {}) {
  return {
    incompatibleCount: BigInt(0),
    corruptCount: BigInt(0),
    id: 'chunk-1',
    sourceId: 'source-1',
    workspaceId: 'workspace-1',
    indexId: 'index-1',
    activeIndexId: 'index-1',
    indexStatus: 'READY',
    sourceVersion: 2,
    chunkSourceVersion: 2,
    content: 'Grounded Lumora research passage with unique production facts.',
    tokenCount: 20,
    chunkIndex: 0,
    similarity: 0.9,
    sourceTitle: 'Lumora Research',
    sourceType: 'TEXT',
    sourceUrl: null,
    parserMetadata: { sourceType: 'TEXT' },
    sourceCleanText: 'Grounded Lumora research passage with unique production facts.',
    embeddingProvider: contract.provider,
    embeddingModel: contract.model,
    embeddingVersion: contract.version,
    vectorDimensions: contract.dimensions,
    ...overrides,
  };
}

function retrievalDependencies(rows: any[], owned = true) {
  let embeddingCalls = 0;
  let workspaceWhere: any = null;
  let retrievalSql = '';
  let retrievalValues: unknown[] = [];
  const dependencies = {
    database: {
      workspace: {
        findFirst: async (args: any) => {
          workspaceWhere = args.where;
          return owned ? { id: 'workspace-1' } : null;
        },
      },
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        retrievalSql = strings.join('');
        retrievalValues = values;
        return rows;
      },
    } as any,
    embedQuery: async () => {
      embeddingCalls += 1;
      return { vectors: [vector()], contract };
    },
  };
  return {
    dependencies,
    state: {
      get embeddingCalls() {
        return embeddingCalls;
      },
      get workspaceWhere() {
        return workspaceWhere;
      },
      get retrievalSql() {
        return retrievalSql;
      },
      get retrievalValues() {
        return retrievalValues;
      },
    },
  };
}

test('ranking is deterministic and removes exact and near-duplicate passages', () => {
  const nearDuplicate =
    'Grounded Lumora research passage with unique production facts and one addition.';
  const ranked = rankAndDeduplicateChunks(
    [
      chunk({ id: 'chunk-3', similarity: 0.8, chunkIndex: 2, content: nearDuplicate }),
      chunk({ id: 'chunk-2', similarity: 0.9, chunkIndex: 1 }),
      chunk({ id: 'chunk-1', similarity: 0.9, chunkIndex: 0 }),
      chunk({
        id: 'chunk-4',
        sourceId: 'source-2',
        similarity: 0.7,
        content: 'Independent relevant evidence from another indexed source.',
      }),
    ],
    5,
    0.15,
  );

  assert.deepEqual(
    ranked.map((item) => item.id),
    ['chunk-1', 'chunk-4'],
  );
});

test('context budgeting keeps complete chunks and reports insufficient context', () => {
  const oversized = chunk({
    id: 'oversized',
    content: 'A'.repeat(1_000),
    tokenCount: 250,
  });
  const fitting = chunk({
    id: 'fitting',
    content: 'Complete fitting chunk.',
    tokenCount: 8,
  });
  const context = buildRAGContext([oversized, fitting], 'question', 'DETAILED', {
    tokenBudget: 60,
  });
  assert.equal(context.hasContext, true);
  assert.deepEqual(context.chunks.map((item) => item.id), ['fitting']);
  assert.match(context.contextPrompt, /Complete fitting chunk\./);
  assert.match(context.contextPrompt, /exclusive factual basis/i);
  assert.match(context.contextPrompt, /Every substantive factual claim/i);
  assert.doesNotMatch(context.contextPrompt, /AAAA/);

  const empty = buildRAGContext([oversized], 'question', 'DETAILED', {
    tokenBudget: 60,
  });
  assert.equal(empty.hasContext, false);
  assert.deepEqual(empty.citations, []);
  assert.match(empty.contextPrompt, /no relevant indexed documents/i);
  assert.match(empty.contextPrompt, /Do NOT invent facts/i);
});

test('citations preserve PDF page, website URL, and transcript timestamps', () => {
  const pdfContent = '[Page 3]\nGrounded PDF evidence.';
  const pdf = createCitation(
    chunk({
      sourceType: 'PDF',
      content: pdfContent,
      sourceCleanText: pdfContent,
      parserMetadata: {
        pages: [
          {
            pageNumber: 3,
            text: 'Grounded PDF evidence.',
            characterStart: 0,
            characterEnd: pdfContent.length,
          },
        ],
      },
    }),
  );
  assert.equal(pdf.sourceId, 'source-1');
  assert.equal(pdf.page, 3);
  assert.equal(pdf.textOrigin, 'PDF page 3');

  const website = createCitation(
    chunk({
      sourceType: 'WEBSITE',
      sourceUrl: 'https://example.com/research',
    }),
  );
  assert.equal(website.kind, 'WEB');
  assert.equal(website.url, 'https://example.com/research');
  assert.match(website.textOrigin, /Website https:\/\/example\.com\/research/);

  const youtube = createCitation(
    chunk({
      sourceType: 'YOUTUBE',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      content: '[00:00:01.000 - 00:00:03.500] Welcome to Lumora',
    }),
  );
  assert.equal(youtube.timestampStartMs, 1_000);
  assert.equal(youtube.timestampEndMs, 3_500);

  const vtt = createCitation(
    chunk({
      sourceType: 'VTT',
      content: '[00:00:04.000 --> 00:00:06.000] Speaker: Grounded learning',
    }),
  );
  assert.equal(vtt.timestampStartMs, 4_000);
  assert.equal(vtt.timestampEndMs, 6_000);
});

test('retrieval validates ownership before generating a query embedding', async () => {
  const { dependencies, state } = retrievalDependencies([], false);
  await assert.rejects(
    searchWorkspaceChunks(
      'workspace-1',
      'other-user',
      'research',
      {},
      dependencies,
    ),
    /access denied/,
  );
  assert.equal(state.embeddingCalls, 0);
  assert.equal(state.workspaceWhere.userId, 'other-user');
});

test('retrieval returns only valid owned active-index candidates', async () => {
  const { dependencies, state } = retrievalDependencies([rawRow()]);
  const results = await searchWorkspaceChunks(
    'workspace-1',
    'user-1',
    'research',
    { topK: 5, threshold: 0.2 },
    dependencies,
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].indexId, 'index-1');
  assert.equal(state.embeddingCalls, 1);
  assert.match(state.retrievalSql, /source\."activeIndexId"/);
  assert.match(state.retrievalSql, /source_index\.status = 'READY'/);
  assert.match(state.retrievalSql, /chunk\."workspaceId"/);
});

test('retrieval rejects cross-Workspace, inactive, stale, and incompatible results', async () => {
  for (const invalid of [
    rawRow({ workspaceId: 'workspace-2' }),
    rawRow({ activeIndexId: 'index-old' }),
    rawRow({ chunkSourceVersion: 1 }),
    rawRow({ embeddingModel: 'text-embedding-3-large' }),
  ]) {
    const { dependencies } = retrievalDependencies([invalid]);
    await assert.rejects(
      searchWorkspaceChunks(
        'workspace-1',
        'user-1',
        'research',
        {},
        dependencies,
      ),
      /Retrieval (isolation|integrity) failure/,
    );
  }
});

test('index incompatibility and corruption fail explicitly instead of returning context', async () => {
  for (const invalidState of [
    rawRow({ id: null, incompatibleCount: BigInt(1) }),
    rawRow({ id: null, corruptCount: BigInt(1) }),
  ]) {
    const { dependencies } = retrievalDependencies([invalidState]);
    await assert.rejects(
      searchWorkspaceChunks(
        'workspace-1',
        'user-1',
        'research',
        {},
        dependencies,
      ),
      /(incompatible|integrity validation failed)/,
    );
  }
});

test('below-threshold candidates produce an empty grounded result', async () => {
  const { dependencies } = retrievalDependencies([rawRow({ similarity: 0.05 })]);
  const results = await searchWorkspaceChunks(
    'workspace-1',
    'user-1',
    'research',
    { threshold: 0.2 },
    dependencies,
  );
  assert.deepEqual(results, []);
});

test('the existing 0.15 boundary accepts equality and rejects the value below it', () => {
  const ranked = rankAndDeduplicateChunks(
    [
      chunk({ id: 'at-boundary', similarity: 0.15 }),
      chunk({
        id: 'below-boundary',
        similarity: 0.149999,
        content: 'Different content below the existing confidence boundary.',
      }),
    ],
    5,
    0.15,
  );
  assert.deepEqual(ranked.map(({ id }) => id), ['at-boundary']);
});

test('source-scoped retrieval constrains candidates before vector ranking and top-K', async () => {
  const requestedSource = 'source-requested';
  const { dependencies, state } = retrievalDependencies([
    rawRow({
      id: 'requested-chunk',
      sourceId: requestedSource,
      indexId: 'requested-index',
      activeIndexId: 'requested-index',
      sourceTitle: 'Explicitly selected source',
    }),
  ]);
  const results = await searchWorkspaceChunks(
    'workspace-1',
    'user-1',
    'question whose global top results belong to other sources',
    { topK: 5, threshold: 0.15, sourceIds: [requestedSource] },
    dependencies,
  );

  assert.deepEqual(results.map(({ sourceId }) => sourceId), [requestedSource]);
  assert.ok(
    state.retrievalValues.some(
      (value) => Array.isArray(value) && value.includes(requestedSource),
    ),
  );
  assert.match(state.retrievalSql, /source\.id = ANY/);
  assert.ok(
    state.retrievalSql.indexOf('source.id = ANY') <
      state.retrievalSql.indexOf('ORDER BY'),
    'source scope must be applied before vector ordering and LIMIT',
  );
});
