import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('different persisted Workspace identities retain distinct configured hover colors', () => {
  const yellow = getWorkspaceIdentity('study');
  const purple = getWorkspaceIdentity('learning');
  assert.equal(yellow.rgb, '251 191 36');
  assert.equal(purple.rgb, '192 132 252');
  assert.notEqual(yellow.rgb, purple.rgb);
});

test('Workspace cards pass their identity color to hover and focus-visible styling', () => {
  const cardSource = readFileSync(new URL('../../pages/WorkspacesPage.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
  assert.match(cardSource, /--identity-rgb/);
  assert.match(cardSource, /focus-within:ring-\[rgb\(var\(--identity-rgb\)/);
  assert.match(styles, /\.workspace-card:hover/);
  assert.match(styles, /border-color: rgb\(var\(--identity-rgb\) \/ 0\.56\)/);
});
