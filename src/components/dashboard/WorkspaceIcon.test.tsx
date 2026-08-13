import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkspaceIdentity, WORKSPACE_IDENTITIES } from './WorkspaceIcon';

test('exposes exactly six deliberate Workspace identities', () => {
  assert.equal(WORKSPACE_IDENTITIES.length, 6);
  assert.deepEqual(
    WORKSPACE_IDENTITIES.map(({ id }) => id),
    ['general', 'developer', 'learning', 'research', 'study', 'experimental'],
  );
});

test('resolves persisted identity keys and legacy icon values consistently', () => {
  assert.equal(getWorkspaceIdentity('developer').id, 'developer');
  assert.equal(getWorkspaceIdentity('brain').id, 'learning');
  assert.equal(getWorkspaceIdentity('database').id, 'research');
  assert.equal(getWorkspaceIdentity('book').id, 'study');
  assert.equal(getWorkspaceIdentity('sparkles').id, 'experimental');
  assert.equal(getWorkspaceIdentity('unknown').id, 'general');
  assert.equal(getWorkspaceIdentity(null).id, 'general');
});
