import assert from 'node:assert/strict';
import test from 'node:test';
import { createReprocessingVersion } from '../source-store';
import { IngestionCoordinator } from './coordinator';

function createFailedYouTubeDatabase() {
  const state = {
    sourceRows: 1,
    source: {
      id: 'source-youtube',
      workspaceId: 'workspace-1',
      currentVersion: 1,
      status: 'FAILED',
      stage: 'FAILED',
      metadata: {
        errorCode: 'TRANSCRIPT_UNAVAILABLE',
        errorCategory: 'TRANSCRIPT_UNAVAILABLE',
        errorMessage: 'No discernible speech was detected.',
        retryable: false,
      } as Record<string, unknown>,
    },
    contents: [{
      sourceId: 'source-youtube',
      version: 1,
      originalContent: null,
      artifactData: null,
      artifactFileName: null,
      artifactMimeType: null,
      artifactSize: null,
      sourceUrl: 'https://www.youtube.com/watch?v=UiMg566PREA',
      parserMetadata: null,
      checksum: 'video-a-checksum',
    }],
    attempts: [{
      id: 'attempt-1',
      sourceId: 'source-youtube',
      version: 1,
      stage: 'FAILED',
      completedAt: new Date('2026-08-13T00:00:00.000Z'),
      updatedAt: new Date('2026-08-13T00:00:00.000Z'),
    }],
    chunks: [] as Array<{ sourceId: string; version: number }>,
    indexes: [] as Array<{ sourceId: string; version: number }>,
  };

  const transaction = {
    source: {
      findUnique: async () => ({
        ...state.source,
        contents: [state.contents.at(-1)],
        processingAttempts: [state.attempts.at(-1)],
      }),
      updateMany: async ({ where, data }: any) => {
        if (
          where.id !== state.source.id ||
          where.currentVersion !== state.source.currentVersion
        ) {
          return { count: 0 };
        }
        Object.assign(state.source, data);
        return { count: 1 };
      },
    },
    sourceContent: {
      create: async ({ data }: any) => {
        state.contents.push(data);
        return data;
      },
    },
    sourceProcessingAttempt: {
      create: async ({ data }: any) => {
        const attempt = {
          id: `attempt-${state.attempts.length + 1}`,
          sourceId: data.sourceId,
          version: data.version,
          stage: data.stage,
          completedAt: null,
          updatedAt: new Date(),
        };
        state.attempts.push(attempt);
        return attempt;
      },
      updateMany: async () => ({ count: 0 }),
    },
    sourceProcessingEvent: {
      create: async () => undefined,
    },
  };
  const database = {
    $transaction: async (operation: (tx: any) => Promise<unknown>) =>
      operation(transaction),
  };
  return { database, state };
}

test('FAILED YouTube reprocess reaches COMPLETED on one fresh version without duplicates', async () => {
  const { database, state } = createFailedYouTubeDatabase();
  const version = await createReprocessingVersion(
    state.source.id,
    {},
    database as any,
  );

  assert.equal(version, 2);
  assert.equal(state.sourceRows, 1);
  assert.equal(state.source.currentVersion, 2);
  assert.equal(state.source.status, 'PENDING');
  assert.equal(state.source.stage, 'CREATED');
  assert.equal(state.source.metadata.errorCode, null);
  assert.deepEqual(state.contents.map(({ version: itemVersion }) => itemVersion), [1, 2]);
  assert.deepEqual(state.attempts.map(({ version: itemVersion }) => itemVersion), [1, 2]);

  let finishProcessing!: () => void;
  const processing = new Promise<void>((resolve) => {
    finishProcessing = resolve;
  });
  let processCalls = 0;
  const coordinator = new IngestionCoordinator({
    process: (async () => {
      processCalls += 1;
      await processing;
      state.chunks.push({ sourceId: state.source.id, version });
      state.indexes.push({ sourceId: state.source.id, version });
      state.source.status = 'COMPLETED';
      state.source.stage = 'COMPLETED';
      return {
        success: true,
        claimed: true,
        chunkCount: 1,
        tokenCount: 149,
      };
    }) as any,
  });

  const job = {
    sourceId: state.source.id,
    workspaceId: state.source.workspaceId,
    title: 'Video A',
    type: 'YOUTUBE' as const,
    version,
  };
  assert.equal(coordinator.dispatch(job), true);
  assert.equal(coordinator.dispatch(job), false);
  finishProcessing();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(processCalls, 1);
  assert.equal(state.source.status, 'COMPLETED');
  assert.equal(state.source.stage, 'COMPLETED');
  assert.deepEqual(state.chunks, [{ sourceId: state.source.id, version: 2 }]);
  assert.deepEqual(state.indexes, [{ sourceId: state.source.id, version: 2 }]);
});

test('an active reprocess version cannot create another source version', async () => {
  const { database, state } = createFailedYouTubeDatabase();
  await createReprocessingVersion(state.source.id, {}, database as any);
  await assert.rejects(
    createReprocessingVersion(state.source.id, {}, database as any),
    /already being processed/,
  );
  assert.equal(state.sourceRows, 1);
  assert.equal(state.contents.length, 2);
  assert.equal(state.attempts.length, 2);
});
