// Source-contract tests for the real checkout wiring, following CLAUDE.md's
// documented convention for components with no jsdom/RTL setup. CheckoutDialog
// calls useAuth()/useAccess(), both of which require a live Clerk instance —
// not available under Node's test runner — so its behavioral contract is
// verified by reading the source and asserting on it, the same way
// payments-route-contract.test.ts verifies the backend routes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const checkoutDialogSource = readFileSync(new URL('./CheckoutDialog.tsx', import.meta.url), 'utf8');
const couponFieldSource = readFileSync(new URL('./CouponField.tsx', import.meta.url), 'utf8');
const paymentStatusPanelSource = readFileSync(new URL('./PaymentStatusPanel.tsx', import.meta.url), 'utf8');
const paymentsApiSource = readFileSync(new URL('./payments-api.ts', import.meta.url), 'utf8');
const checkoutMachineSource = readFileSync(new URL('../../lib/payments/checkout-machine.ts', import.meta.url), 'utf8');

// --- Frontend never sends a trusted amount/price/discount ----------------

test('CheckoutDialog never sends amount, price, or discount to POST /order', () => {
  const start = checkoutDialogSource.indexOf("postPaymentsApi<OrderResponse>('/order'");
  const end = checkoutDialogSource.indexOf("if (orderResult.status === 'error')");
  assert.ok(start >= 0 && end > start);
  const orderCall = checkoutDialogSource.slice(start, end);
  assert.doesNotMatch(orderCall, /\bamount\s*:/);
  assert.doesNotMatch(orderCall, /\bprice\s*:/);
  assert.doesNotMatch(orderCall, /\bdiscount\w*\s*:/);
  assert.match(orderCall, /plan,/);
});

test('CheckoutDialog only ever displays amounts that came from a server response (OrderResponse/QuoteResponse), never a client computation', () => {
  assert.match(checkoutDialogSource, /appliedQuote\?\.finalAmount \?\? baseAmount/);
  // baseAmount itself is launchAmountFor(plan) — the same server-defined
  // constant POST /order resolves server-side, used here only for the
  // pre-quote display default, never sent to the server as a request field.
  assert.match(checkoutDialogSource, /launchAmountFor\(plan\)/);
});

test('CouponField never computes its own discount — it only ever displays what POST /quote returned', () => {
  assert.doesNotMatch(couponFieldSource, /discountAmount\s*=\s*[^r]/); // no local assignment other than from the response
  assert.match(couponFieldSource, /postPaymentsApi<QuoteResponse>\('\/quote'/);
  assert.doesNotMatch(couponFieldSource, /\*\s*0\.\d/); // no percentage math in the component
});

// --- Fresh order per attempt ----------------------------------------------

test('every Pay click creates a fresh order — runCheckout dispatches START before POST /order, resetting orderId', () => {
  const runCheckoutStart = checkoutDialogSource.indexOf('const runCheckout = async () => {');
  const runCheckoutOrderCall = checkoutDialogSource.indexOf("postPaymentsApi<OrderResponse>('/order'");
  assert.ok(runCheckoutStart >= 0 && runCheckoutOrderCall > runCheckoutStart);
  const startToOrder = checkoutDialogSource.slice(runCheckoutStart, runCheckoutOrderCall);
  assert.match(startToOrder, /dispatch\(\{ type: 'START'/);
});

test("the checkout machine's START event always resets context.orderId to null, so a retry never reuses a previous order", () => {
  assert.match(
    checkoutMachineSource,
    /case 'START':\s*\n\s*return \{\s*\n\s*\.\.\.INITIAL_CHECKOUT_CONTEXT,/,
  );
});

test('the dialog resets to a clean slate (RESET) every time it is opened, so a stale order/coupon/error from a previous attempt never leaks in', () => {
  const effectStart = checkoutDialogSource.indexOf('useEffect(() => {\n    if (!isOpen) return;\n    dispatch({ type: \'RESET\' });');
  assert.ok(effectStart >= 0, 'expected an open-triggered RESET effect');
});

// --- dismissed !== failed, no infinite spinners ---------------------------

test('modal.ondismiss dispatches DISMISSED, never FAILED, and payment.failed dispatches RAZORPAY_FAILED separately', () => {
  assert.match(checkoutDialogSource, /ondismiss:\s*\(\)\s*=>\s*dispatch\(\{\s*type:\s*'DISMISSED'\s*\}\)/);
  assert.match(checkoutDialogSource, /rzp\.on\('payment\.failed'/);
  const paymentFailedIndex = checkoutDialogSource.indexOf("rzp.on('payment.failed'");
  const dismissedIndex = checkoutDialogSource.indexOf("ondismiss:");
  assert.ok(paymentFailedIndex >= 0 && dismissedIndex >= 0 && paymentFailedIndex !== dismissedIndex);
});

test('PaymentStatusPanel renders distinct, non-error copy for the dismissed state (never the word "failed")', () => {
  const dismissedBlockStart = paymentStatusPanelSource.indexOf("if (state === 'dismissed') {");
  const dismissedBlockEnd = paymentStatusPanelSource.indexOf("if (state === 'awaiting_bank_confirmation') {");
  assert.ok(dismissedBlockStart >= 0 && dismissedBlockEnd > dismissedBlockStart);
  const dismissedBlock = paymentStatusPanelSource.slice(dismissedBlockStart, dismissedBlockEnd);
  assert.doesNotMatch(dismissedBlock, /\bfailed\b/i);
  assert.match(dismissedBlock, /No money was taken/);
});

test('every working (spinner) state in PaymentStatusPanel renders accompanying text, never a bare spinner', () => {
  const workingStates = ['creating_order', 'gateway_opening', 'awaiting_payment', 'verifying', 'activating'];
  for (const state of workingStates) {
    const marker = `if (state === '${state}') {`;
    const index = paymentStatusPanelSource.indexOf(marker);
    assert.ok(index >= 0, `expected a branch for ${state}`);
    const block = paymentStatusPanelSource.slice(index, index + 200);
    assert.match(block, /text="[^"]+"/, `expected ${state} to render descriptive text alongside its spinner`);
  }
});

test('every terminal/recoverable state renders at least one actionable control (retry, check status, or continue) — never a dead end', () => {
  assert.match(paymentStatusPanelSource, /onClick=\{onDone\}/); // success
  assert.match(paymentStatusPanelSource, /onClick=\{onRetry\}/); // failed / dismissed / awaiting_bank_confirmation
  assert.match(paymentStatusPanelSource, /onClick=\{onCheckStatus\}/); // dismissed / awaiting_bank_confirmation recovery
});

// --- Razorpay methods are never restricted --------------------------------

test('CheckoutDialog never restricts Razorpay Standard Checkout payment methods', () => {
  const optionsStart = checkoutDialogSource.indexOf('const options: RazorpayCheckoutOptions');
  const optionsEnd = checkoutDialogSource.indexOf('const rzp = new window.Razorpay(options);');
  assert.ok(optionsStart >= 0 && optionsEnd > optionsStart);
  const optionsBlock = checkoutDialogSource.slice(optionsStart, optionsEnd);
  assert.doesNotMatch(optionsBlock, /\bmethod\s*:/);
  assert.doesNotMatch(optionsBlock, /\bconfig\s*:\s*\{\s*display/); // no restrictive display config either
});

// --- Success reflects immediately, no manual reload -----------------------

test('verify success calls notifyUsageChanged() and awaits access.refresh() before dispatching ACTIVATED', () => {
  const successStart = checkoutDialogSource.indexOf("dispatch({ type: 'VERIFY_OK' });");
  const activatedIndex = checkoutDialogSource.indexOf("dispatch({ type: 'ACTIVATED' });");
  assert.ok(successStart >= 0 && activatedIndex > successStart);
  const block = checkoutDialogSource.slice(successStart, activatedIndex);
  assert.match(block, /notifyUsageChanged\(\)/);
  assert.match(block, /await access\.refresh\(\)/);
});

test('the recovery checkStatus() path also calls notifyUsageChanged() + access.refresh() when it finds a captured payment', () => {
  const checkStatusStart = checkoutDialogSource.indexOf('const checkStatus = async () => {');
  const checkStatusEnd = checkoutDialogSource.indexOf('const handleRetry =');
  assert.ok(checkStatusStart >= 0 && checkStatusEnd > checkStatusStart);
  const block = checkoutDialogSource.slice(checkStatusStart, checkStatusEnd);
  assert.match(block, /notifyUsageChanged\(\)/);
  assert.match(block, /await access\.refresh\(\)/);
});

// --- PAYMENT_NOT_CAPTURED / recovery routes to the right state ------------

test('a 409 PAYMENT_NOT_CAPTURED verify response routes to VERIFY_NOT_CAPTURED, not a generic failure', () => {
  assert.match(
    checkoutDialogSource,
    /verifyResult\.code === 'PAYMENT_NOT_CAPTURED'[\s\S]{0,80}dispatch\(\{ type: 'VERIFY_NOT_CAPTURED'/,
  );
});

test('checkStatus re-reads the SPECIFIC order from payment history rather than inferring success from a generic access refresh', () => {
  const checkStatusStart = checkoutDialogSource.indexOf('const checkStatus = async () => {');
  const checkStatusEnd = checkoutDialogSource.indexOf('const handleRetry =');
  const block = checkoutDialogSource.slice(checkStatusStart, checkStatusEnd);
  assert.match(block, /record\.providerOrderId === orderId/);
  assert.match(block, /match\?\.status === 'CAPTURED'/);
});

// --- payments-api.ts never leaks the discriminant-narrowing footgun ------

test('payments-api.ts uses a string-literal discriminant ("ok" | "error"), not a boolean one, so callers narrow correctly without strictNullChecks', () => {
  assert.match(paymentsApiSource, /status:\s*'ok';/);
  assert.match(paymentsApiSource, /status:\s*'error';/);
  assert.doesNotMatch(paymentsApiSource, /ok:\s*true;/);
  assert.doesNotMatch(paymentsApiSource, /ok:\s*false;/);
});

// --- Regression: closing the dialog must not leave a zombie Razorpay
// overlay behind (verified live in Test Mode: rzp.close() alone did not
// remove the .razorpay-container node — it stayed fully visible,
// pointer-events:auto, at the maximum z-index, and stole focus, blocking
// a freshly-reopened dialog's own controls). --------------------------

test('CheckoutDialog closes the live Razorpay instance AND removes any .razorpay-container node on close/unmount', () => {
  const cleanupStart = checkoutDialogSource.indexOf('razorpayInstanceRef.current?.close();');
  assert.ok(cleanupStart >= 0, 'expected the cleanup effect to call razorpayInstanceRef.current?.close()');
  const cleanupBlock = checkoutDialogSource.slice(cleanupStart, cleanupStart + 200);
  assert.match(cleanupBlock, /razorpayInstanceRef\.current = null;/);
  assert.match(cleanupBlock, /document\.querySelectorAll\('\.razorpay-container'\)\.forEach\(\(node\) => node\.remove\(\)\)/);
});

test('the Razorpay-overlay cleanup runs via a useEffect CLEANUP function (fires on unmount), not a body-conditional that would never execute', () => {
  const effectStart = checkoutDialogSource.indexOf('useEffect(() => {\n    if (!isOpen) return;\n    return () => {\n      razorpayInstanceRef.current?.close();');
  assert.ok(effectStart >= 0, 'expected the cleanup to be registered via `return () => { ... }` inside the effect, not run in the effect body');
});

test('the created Razorpay instance is captured in razorpayInstanceRef immediately after construction', () => {
  const constructIndex = checkoutDialogSource.indexOf('const rzp = new window.Razorpay(options);');
  const refAssignIndex = checkoutDialogSource.indexOf('razorpayInstanceRef.current = rzp;');
  assert.ok(constructIndex >= 0 && refAssignIndex > constructIndex && refAssignIndex < constructIndex + 60);
});

// --- Focus management must not depend on the page actually compositing --

test('initial focus-on-open uses a macrotask (setTimeout), not requestAnimationFrame, which can be indefinitely deferred in a backgrounded/non-compositing tab', () => {
  // Strip comments first — the effect's own explanatory comment legitimately
  // names requestAnimationFrame to explain why it was rejected, which would
  // otherwise false-positive this check.
  const codeOnly = checkoutDialogSource
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  assert.doesNotMatch(codeOnly, /requestAnimationFrame/);
  assert.match(codeOnly, /setTimeout\(\(\) => closeButtonRef\.current\?\.focus\(\), 0\)/);
});

test('focus is restored to whatever triggered the dialog when it closes', () => {
  assert.match(checkoutDialogSource, /const previouslyFocused = document\.activeElement/);
  assert.match(checkoutDialogSource, /previouslyFocused\?\.focus\?\.\(\)/);
});

test('Tab is trapped inside the dialog via a dedicated keydown handler, cycling both forward and backward at the boundaries', () => {
  assert.match(checkoutDialogSource, /event\.key !== 'Tab' \|\| !dialogRef\.current/);
  assert.match(checkoutDialogSource, /event\.shiftKey && document\.activeElement === first/);
  assert.match(checkoutDialogSource, /!event\.shiftKey && document\.activeElement === last/);
});
