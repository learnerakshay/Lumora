import assert from 'node:assert/strict';
import test from 'node:test';
import { createSource, DuplicateSourceError } from '../source-store';

function createSerializedSourceDatabase() {
  const sources: Array<{ title: string; metadata: Record<string, unknown> }> = [];
  let lock = Promise.resolve();
  const transaction = {
    $queryRaw: async () => [{ id: 'workspace-1' }],
    source: {
      findMany: async () => sources,
      create: async ({ data }: any) => {
        const now = new Date();
        const source = { title: data.title, metadata: data.metadata };
        sources.push(source);
        return {
          id: `source-${sources.length}`,
          workspaceId: data.workspaceId,
          title: data.title,
          type: data.type,
          status: data.status,
          stage: data.stage,
          currentVersion: data.currentVersion,
          metadata: data.metadata,
          createdAt: now,
          updatedAt: now,
        };
      },
    },
  };
  const database = {
    $transaction: async (operation: (tx: any) => Promise<unknown>) => {
      const previous = lock;
      let release!: () => void;
      lock = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await operation(transaction);
      } finally {
        release();
      }
    },
  };
  return { database, sources };
}

test('rapid duplicate source creation has one database-authoritative winner', async () => {
  const { database, sources } = createSerializedSourceDatabase();
  const input = {
    workspaceId: 'workspace-1',
    title: 'Canonical lecture',
    type: 'YOUTUBE' as const,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    artifact: {
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  };
  const results = await Promise.allSettled([
    createSource(input, database as any),
    createSource(input, database as any),
  ]);
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejection = results.find(({ status }) => status === 'rejected');
  assert.ok(rejection && rejection.status === 'rejected');
  assert.ok(rejection.reason instanceof DuplicateSourceError);
  assert.equal(sources.length, 1);
});
