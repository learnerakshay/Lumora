import assert from 'node:assert/strict';
import test from 'node:test';
import { isProcessingAttemptStale } from '../source-store';
import { IngestionCoordinator } from './coordinator';

const job = {
  sourceId: 'source-1',
  workspaceId: 'workspace-1',
  title: 'Source',
  type: 'TEXT' as const,
  version: 1,
};

function completedResult() {
  return {
    success: true,
    claimed: true,
    chunkCount: 1,
    tokenCount: 10,
  };
}

test('coordinator deduplicates local dispatch while database claim remains authoritative', async () => {
  let finish!: () => void;
  let calls = 0;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const coordinator = new IngestionCoordinator({
    process: (async () => {
      calls += 1;
      await pending;
      return completedResult();
    }) as any,
  });

  assert.equal(coordinator.dispatch(job), true);
  assert.equal(coordinator.dispatch(job), false);
  assert.equal(calls, 1);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(coordinator.dispatch(job), true);
});

test('recovery sweep is non-overlapping and dispatches recovered versions', async () => {
  let finishRecovery!: (value: any[]) => void;
  const recovery = new Promise<any[]>((resolve) => {
    finishRecovery = resolve;
  });
  const processed: string[] = [];
  const coordinator = new IngestionCoordinator({
    process: (async (options) => {
      processed.push(`${options.sourceId}:${options.version}`);
      return completedResult();
    }) as any,
    recover: (async () => recovery) as any,
  });

  const first = coordinator.recoverStale({
    staleAfterMs: 60_000,
    maxAutomaticRecoveries: 2,
  });
  const overlapping = await coordinator.recoverStale({
    staleAfterMs: 60_000,
    maxAutomaticRecoveries: 2,
  });
  assert.equal(overlapping, 0);
  finishRecovery([{ ...job, version: 2 }]);
  assert.equal(await first, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(processed, ['source-1:2']);
});

test('stale detection uses the configured bounded lease window', () => {
  const now = new Date('2026-08-11T12:00:00.000Z');
  assert.equal(
    isProcessingAttemptStale(
      new Date('2026-08-11T11:44:59.999Z'),
      15 * 60 * 1_000,
      now,
    ),
    true,
  );
  assert.equal(
    isProcessingAttemptStale(
      new Date('2026-08-11T11:50:00.000Z'),
      15 * 60 * 1_000,
      now,
    ),
    false,
  );
});
