import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchDashboardWorkspaces,
  groupDashboardSourceSummaries,
  shouldLoadDashboardSourceSummaries,
} from './workspace-dashboard-data';

function response(data: unknown, ok = true): Response {
  return {
    ok,
    json: async () => ok
      ? ({ success: true, data })
      : ({ success: false, error: { message: 'Workspace request failed.' } }),
  } as Response;
}

test('deduplicates concurrent core Workspace requests for the authenticated user', async () => {
  let calls = 0;
  let resolveRequest: ((value: Response) => void) | undefined;
  const request = (() => {
    calls += 1;
    return new Promise<Response>((resolve) => { resolveRequest = resolve; });
  }) as typeof fetch;

  const first = fetchDashboardWorkspaces('user-dedupe', request);
  const replay = fetchDashboardWorkspaces('user-dedupe', request);
  assert.equal(first, replay);
  assert.equal(calls, 1);

  resolveRequest?.(response([]));
  assert.deepEqual(await first, []);
});

test('clears a failed in-flight request so dashboard retry can issue a new request', async () => {
  let calls = 0;
  const request = (async () => {
    calls += 1;
    return calls === 1 ? response(null, false) : response([]);
  }) as typeof fetch;

  await assert.rejects(fetchDashboardWorkspaces('user-retry', request));
  assert.deepEqual(await fetchDashboardWorkspaces('user-retry', request), []);
  assert.equal(calls, 2);
});

test('groups one batch of secondary source metadata without per-Workspace requests', () => {
  const grouped = groupDashboardSourceSummaries([
    { id: 's1', workspaceId: 'w1', type: 'PDF', status: 'COMPLETED' },
    { id: 's2', workspaceId: 'w2', type: 'TEXT', status: 'PROCESSING' },
    { id: 's3', workspaceId: 'w1', type: 'WEBSITE', status: 'COMPLETED' },
  ]);

  assert.deepEqual(grouped.w1.map((source) => source.id), ['s1', 's3']);
  assert.deepEqual(grouped.w2.map((source) => source.id), ['s2']);
});

test('zero-Workspace results skip all secondary metadata work', () => {
  assert.equal(shouldLoadDashboardSourceSummaries([]), false);
  assert.equal(shouldLoadDashboardSourceSummaries([{
    id: 'w1',
    name: 'Workspace',
    slug: 'workspace',
    description: null,
    icon: null,
    userId: 'user-1',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    sourcesCount: 0,
  }]), true);
});
