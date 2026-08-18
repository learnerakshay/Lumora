// This repo has no jsdom/React Testing Library (see CLAUDE.md), so DOM-
// dependent behavior (script injection, load/error events) is verified as
// a source contract — reading the file as text and asserting on its
// structure — the same pattern used by grounding-route-contract.test.ts
// and workspace-interactions.test.ts. The one piece that is pure (the
// exported script URL constant) is verified by direct import.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { RAZORPAY_CHECKOUT_SCRIPT_SRC } from './useRazorpayCheckout';

const source = readFileSync(new URL('./useRazorpayCheckout.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

test('exports the real Razorpay Checkout.js URL', () => {
  assert.equal(RAZORPAY_CHECKOUT_SCRIPT_SRC, 'https://checkout.razorpay.com/v1/checkout.js');
});

test('the Razorpay script is never referenced in index.html — it must load on demand only', () => {
  assert.doesNotMatch(indexHtml, /checkout\.razorpay\.com/);
});

test('the script-load promise is memoized at module scope, not re-created per call', () => {
  assert.match(source, /let checkoutScriptPromise: Promise<void> \| null = null;/);
  assert.match(source, /if \(checkoutScriptPromise\) \{\s*\n\s*return checkoutScriptPromise;/);
});

test('a failed retry clears the memoized promise so a later attempt can load again', () => {
  const catchIndex = source.indexOf('checkoutScriptPromise.catch(() => {');
  assert.ok(catchIndex >= 0);
  const clearSlice = source.slice(catchIndex, catchIndex + 120);
  assert.match(clearSlice, /checkoutScriptPromise = null;/);
});

test('script injection is async and appended to document.head, never document.write', () => {
  assert.match(source, /script\.async = true;/);
  assert.match(source, /document\.head\.appendChild\(script\)/);
  assert.doesNotMatch(source, /document\.write/);
});

test('both script.onerror and the existing-script error path reject with a real, user-presentable message', () => {
  const onErrorMatches = source.match(/reject\(new Error\('([^']+)'\)\)/g) ?? [];
  assert.ok(onErrorMatches.length >= 2, 'expected at least two distinct real error-message rejections');
  for (const match of onErrorMatches) {
    assert.doesNotMatch(match, /^reject\(new Error\(''\)\)$/);
  }
  assert.match(source, /ad-blocker/);
});

test('ensureLoaded exposes ready/error status and is not auto-invoked on mount', () => {
  assert.match(source, /export function useRazorpayCheckout/);
  assert.match(source, /ensureLoaded/);
  // The hook must not call ensureLoaded/loadRazorpayCheckoutScript inside a
  // bare useEffect(() => { ... }, []) — loading must stay opt-in, triggered
  // by the caller (e.g. opening the checkout dialog), never automatically.
  const hookStart = source.indexOf('export function useRazorpayCheckout');
  const hookBody = source.slice(hookStart);
  assert.doesNotMatch(hookBody, /useEffect\(\(\) => \{\s*\n\s*(void )?ensureLoaded\(/);
  assert.doesNotMatch(hookBody, /useEffect\(\(\) => \{\s*\n\s*(void )?loadRazorpayCheckoutScript\(/);
});

test('does not open Checkout UI — no `.open()` call or `new window.Razorpay(` construction in this module', () => {
  // Strip comments first: the module's own doc comment mentions
  // `new window.Razorpay(options).open()` as prose describing what Phase
  // 3B will do, which would otherwise false-positive this check.
  const codeOnly = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  assert.doesNotMatch(codeOnly, /\.open\(\)/);
  assert.doesNotMatch(codeOnly, /new window\.Razorpay\(/);
});
