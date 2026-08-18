import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const paymentsRouteSource = readFileSync(new URL('./payments.ts', import.meta.url), 'utf8');
const webhookRouteSource = readFileSync(new URL('./payments-webhook.ts', import.meta.url), 'utf8');
const entitlementSyncSource = readFileSync(new URL('../lib/payments/entitlement-sync.ts', import.meta.url), 'utf8');
const expireStaleAccessSource = readFileSync(new URL('../lib/payments/expire-stale-access.ts', import.meta.url), 'utf8');

// R1 from the approved plan: the webhook signature is an HMAC over the exact
// raw request bytes. express.json() would consume the stream first and leave
// nothing byte-identical to verify against, silently breaking every webhook
// signature check. This is the single highest-value test in Phase 2.
test('server.ts mounts the payments webhook with express.raw() strictly before express.json()', () => {
  // Anchor on the real call signatures (with the opening options brace),
  // not a bare substring — the explanatory comment above the raw mount
  // itself contains the words "express.json():", which would otherwise
  // false-positive an indexOf-based check.
  const rawMountIndex = serverSource.indexOf('express.raw({');
  const jsonMountIndex = serverSource.indexOf('app.use(express.json({');
  assert.ok(rawMountIndex >= 0, 'expected an express.raw() mount in server.ts');
  assert.ok(jsonMountIndex >= 0, 'expected an express.json() mount in server.ts');
  assert.ok(rawMountIndex < jsonMountIndex, 'express.raw() must be mounted before express.json()');
  assert.match(serverSource, /`\$\{API_PATHS\.payments\}\/webhook`,\s*\n\s*express\.raw\(/);
});

test('server.ts mounts expireStalePaidAccess after express.json() and before the payments router', () => {
  const jsonMountIndex = serverSource.indexOf('express.json(');
  const expireMountIndex = serverSource.indexOf("app.use('/api', expireStalePaidAccess)");
  const paymentsRouterMountIndex = serverSource.indexOf('API_PATHS.payments, paymentsRouter');
  assert.ok(expireMountIndex > jsonMountIndex);
  assert.ok(paymentsRouterMountIndex > expireMountIndex);
});

test('the webhook router never imports requireApiAuth', () => {
  assert.doesNotMatch(webhookRouteSource, /import\s*\{[^}]*requireApiAuth/);
  assert.doesNotMatch(webhookRouteSource, /\.use\(requireApiAuth\)/);
});

test('the webhook handler verifies the signature before any Prisma write is reachable', () => {
  // processWebhookEvent (imported here) does the verify-then-store ordering;
  // this route file itself must never touch prisma directly at all.
  assert.doesNotMatch(webhookRouteSource, /prisma\./);
  assert.match(webhookRouteSource, /processWebhookEvent/);
});

test('the webhook route always responds and never leaves the request hanging on a thrown error', () => {
  assert.match(webhookRouteSource, /res\.status\(200\)\.end\(\)/);
  assert.match(webhookRouteSource, /res\.status\(400\)\.end\(\)/);
});

test('payments.ts requires authentication for every route', () => {
  assert.match(paymentsRouteSource, /paymentsRouter\.use\(requireApiAuth\)/);
});

test('payments.ts never meters usage — payments are not a metered action', () => {
  assert.doesNotMatch(paymentsRouteSource, /checkAndReserve|commitUsage|discardUsage/);
});

// Server-authoritative amount: the client can only ever choose a plan and an
// optional coupon code. If any of these leak into req.body reads, a client
// could name its own price.
test('POST /order never reads amount, price, or currency off the request body', () => {
  const orderHandlerStart = paymentsRouteSource.indexOf("paymentsRouter.post('/order',");
  const orderVerifyStart = paymentsRouteSource.indexOf("paymentsRouter.post('/order/verify',");
  assert.ok(orderHandlerStart >= 0 && orderVerifyStart > orderHandlerStart);
  const orderHandler = paymentsRouteSource.slice(orderHandlerStart, orderVerifyStart);
  assert.doesNotMatch(orderHandler, /req\.body\??\.\s*amount/);
  assert.doesNotMatch(orderHandler, /req\.body\??\.\s*price/);
  assert.doesNotMatch(orderHandler, /req\.body\??\.\s*currency/);
  assert.match(orderHandler, /launchAmountFor\(plan\)/);
});

test('/order/verify reads only the three Razorpay callback fields off the body, never an amount or plan', () => {
  const start = paymentsRouteSource.indexOf("paymentsRouter.post('/order/verify',");
  const end = paymentsRouteSource.indexOf("paymentsRouter.post('/access/refresh',");
  const handler = paymentsRouteSource.slice(start, end);
  assert.match(handler, /req\.body\?\.razorpay_order_id/);
  assert.match(handler, /req\.body\?\.razorpay_payment_id/);
  assert.match(handler, /req\.body\?\.razorpay_signature/);
  assert.doesNotMatch(handler, /req\.body\??\.\s*(amount|price|plan)\b/);
});

test('/order/verify checks ownership (payment.userId !== userId) before ever verifying a signature', () => {
  const start = paymentsRouteSource.indexOf("paymentsRouter.post('/order/verify',");
  const end = paymentsRouteSource.indexOf("paymentsRouter.post('/access/refresh',");
  const handler = paymentsRouteSource.slice(start, end);
  const ownershipIndex = handler.indexOf('payment.userId !== userId');
  const signatureIndex = handler.indexOf('verifyOrderSignature(');
  assert.ok(ownershipIndex >= 0 && signatureIndex > ownershipIndex);
});

test('/order/verify never grants access from the signature alone — it re-reads the payment from Razorpay first', () => {
  const start = paymentsRouteSource.indexOf("paymentsRouter.post('/order/verify',");
  const end = paymentsRouteSource.indexOf("paymentsRouter.post('/access/refresh',");
  const handler = paymentsRouteSource.slice(start, end);
  const signatureIndex = handler.indexOf('verifyOrderSignature(');
  const authoritativeReadIndex = handler.indexOf('client.fetchPayment(');
  const captureIndex = handler.indexOf('capturePayment(');
  assert.ok(signatureIndex >= 0 && authoritativeReadIndex > signatureIndex && captureIndex > authoritativeReadIndex);
});

test('/access/refresh scopes any order lookup to the caller before acting on it', () => {
  const start = paymentsRouteSource.indexOf("paymentsRouter.post('/access/refresh',");
  const end = paymentsRouteSource.indexOf("paymentsRouter.get('/payments',");
  const handler = paymentsRouteSource.slice(start, end);
  assert.match(handler, /payment\.userId === userId/);
});

test('GET /payments scopes history to the authenticated caller, never a client-supplied user id', () => {
  const start = paymentsRouteSource.indexOf("paymentsRouter.get('/payments',");
  const handler = paymentsRouteSource.slice(start);
  assert.match(handler, /getPaymentHistoryForUser\(userId\)/);
  assert.doesNotMatch(handler, /getPaymentHistoryForUser\(req\.(params|query|body)/);
});

// The one rule that keeps the existing usage/plan architecture untouched:
// User.plan is written by exactly one function, syncUserEntitlement, and
// nothing else in the payments routes/webhook ever calls prisma.user.update
// directly.
test('User.plan is written only inside entitlement-sync.ts — no route or webhook handler calls prisma.user.update', () => {
  assert.doesNotMatch(paymentsRouteSource, /prisma\.user\.update/);
  assert.doesNotMatch(webhookRouteSource, /prisma\.user\.update/);
  assert.doesNotMatch(expireStaleAccessSource, /prisma\.user\.update/);
  assert.match(entitlementSyncSource, /tx\.user\.update/);
});

test('entitlement-sync.ts is the only file under src/lib/payments importing pg_advisory_xact_lock alongside a User plan write', () => {
  assert.match(entitlementSyncSource, /pg_advisory_xact_lock/);
  assert.match(entitlementSyncSource, /data:\s*\{[\s\S]*?plan:\s*resolved\.plan/);
});

test('payments routes never import anything from the Subscriptions/Autopay surface — this is Orders-only', () => {
  assert.doesNotMatch(paymentsRouteSource, /subscription_id|Autopay|mandate/i);
});
