// Source-contract tests (readFileSync + assert.match), following the
// established pattern for behavior that has no jsdom/RTL to render against
// (see CLAUDE.md "Conventions"). These verify the specific architectural
// requirements called out for Phase 3A: AccessProvider must never poll
// GET /access (it runs a server-side advisory-lock transaction on every
// call), and both hooks must scope their fetch to the authenticated user
// via the existing AuthProvider, not a client-supplied id.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const accessProviderSource = readFileSync(
  new URL('./AccessProvider.tsx', import.meta.url),
  'utf8',
);
const paymentHistorySource = readFileSync(
  new URL('./usePaymentHistory.ts', import.meta.url),
  'utf8',
);
const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');

test('AccessProvider fetches GET /api/payments/access, not any other payments route', () => {
  assert.match(accessProviderSource, /`\$\{API_PATHS\.payments\}\/access`/);
});

test('AccessProvider never polls — no setInterval/setTimeout anywhere in the module', () => {
  assert.doesNotMatch(accessProviderSource, /setInterval\(/);
  assert.doesNotMatch(accessProviderSource, /setTimeout\(/);
});

test('AccessProvider fetches on the auth-identity effect and exposes an explicit refresh() for on-demand calls', () => {
  assert.match(accessProviderSource, /useEffect\(\(\) => \{[\s\S]*?void refresh\(\);[\s\S]*?\}, \[authenticatedUserId, isSignedIn\]\);/);
  assert.match(accessProviderSource, /refresh: \(\) => Promise<void>/);
});

test('AccessProvider clears state on sign-out rather than serving a stale plan', () => {
  assert.match(accessProviderSource, /if \(!isSignedIn\) \{\s*\n\s*setPlan\(null\);/);
});

test('AccessProvider exposes useAccess() and throws outside its provider, matching useUsage()\'s contract', () => {
  assert.match(accessProviderSource, /export function useAccess\(\)/);
  assert.match(accessProviderSource, /throw new Error\('useAccess must be used within AccessProvider'\)/);
});

test('usePaymentHistory fetches GET /api/payments/payments, scoped to the authenticated caller only', () => {
  assert.match(paymentHistorySource, /`\$\{API_PATHS\.payments\}\/payments`/);
  assert.doesNotMatch(paymentHistorySource, /req\.(params|query)/);
});

test('usePaymentHistory never polls', () => {
  assert.doesNotMatch(paymentHistorySource, /setInterval\(/);
  assert.doesNotMatch(paymentHistorySource, /setTimeout\(/);
});

test('AccessProvider is mounted in App.tsx inside AuthProvider, alongside UsageProvider', () => {
  assert.match(appSource, /import \{ AccessProvider \} from '\.\/components\/payments\/AccessProvider';/);
  const authIndex = appSource.indexOf('<AuthProvider>');
  const accessIndex = appSource.indexOf('<AccessProvider>');
  const usageIndex = appSource.indexOf('<UsageProvider>');
  assert.ok(authIndex >= 0 && accessIndex > authIndex, 'AccessProvider must be nested inside AuthProvider');
  assert.ok(usageIndex > 0, 'UsageProvider must still be mounted');
});
