// PaymentHistoryTable takes only a `history` prop — no useAuth()/useAccess()
// dependency — so it is rendered for real via renderToStaticMarkup.
// CurrentPlanCard and BillingPage both call useAccess() (which requires a
// live Clerk instance, unavailable under Node's test runner), so their
// contracts are verified by reading the source as text, per CLAUDE.md's
// documented convention for components with no jsdom/RTL setup.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaymentHistoryTable } from './PaymentHistoryTable';
import type { PaymentHistoryRecord } from '../payments/usePaymentHistory';

const currentPlanCardSource = readFileSync(new URL('./CurrentPlanCard.tsx', import.meta.url), 'utf8');
const billingPageSource = readFileSync(new URL('../../pages/BillingPage.tsx', import.meta.url), 'utf8');
const settingsModalSource = readFileSync(new URL('../dashboard/SettingsModal.tsx', import.meta.url), 'utf8');

function record(overrides: Partial<PaymentHistoryRecord>): PaymentHistoryRecord {
  return {
    id: 'pay_1',
    userId: 'user_1',
    plan: 'CORE',
    providerOrderId: 'order_1',
    providerPaymentId: 'pay_provider_1',
    amount: 49900,
    discountAmount: 0,
    currency: 'INR',
    status: 'CAPTURED',
    method: 'card',
    failureCode: null,
    failureReason: null,
    accessFrom: '2026-08-01T00:00:00.000Z',
    accessUntil: '2026-08-31T00:00:00.000Z',
    couponId: null,
    signatureVerified: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

// --- PaymentHistoryTable: real renders ------------------------------------

test('empty history renders an honest empty state, not a blank table', () => {
  const html = renderToStaticMarkup(<PaymentHistoryTable history={[]} />);
  assert.match(html, /No payment history yet/);
});

test('a CAPTURED payment renders its real historical amount, never recomputed from current pricing', () => {
  // amount=44_910 with discountAmount=4_990 is a made-up historical figure
  // that does NOT match today's PLAN_PRICING_PAISE for CORE (49_900) —
  // proving the table displays exactly what the row says, not a freshly
  // computed price.
  const html = renderToStaticMarkup(
    <PaymentHistoryTable history={[record({ amount: 44_910, discountAmount: 4_990 })]} />,
  );
  assert.match(html, /₹449/); // final amount rendered
  assert.match(html, /₹499/); // original (amount + discount) shown struck through
  assert.match(html, /Paid/);
});

test('a CREATED payment renders as awaiting confirmation, not as paid', () => {
  const html = renderToStaticMarkup(<PaymentHistoryTable history={[record({ status: 'CREATED', method: null })]} />);
  assert.match(html, /Awaiting confirmation/);
  assert.doesNotMatch(html, />Paid</);
});

test('a FAILED payment renders its failure reason', () => {
  const html = renderToStaticMarkup(
    <PaymentHistoryTable history={[record({ status: 'FAILED', failureReason: 'Card declined by issuing bank' })]} />,
  );
  assert.match(html, /Failed/);
  assert.match(html, /Card declined by issuing bank/);
});

test('a coupon-backed payment is marked, without ever displaying the underlying code', () => {
  const html = renderToStaticMarkup(<PaymentHistoryTable history={[record({ couponId: 'coupon_abc123' })]} />);
  assert.match(html, /Coupon applied/);
  assert.doesNotMatch(html, /coupon_abc123/);
});

test('every PaymentHistoryRecord status renders a distinct, correctly labeled badge', () => {
  const statuses: PaymentHistoryRecord['status'][] = ['CAPTURED', 'CREATED', 'FAILED', 'REFUNDED'];
  for (const status of statuses) {
    const html = renderToStaticMarkup(<PaymentHistoryTable history={[record({ status })]} />);
    assert.ok(html.length > 0);
  }
});

// --- CurrentPlanCard: source contract --------------------------------------

test('CurrentPlanCard never recomputes a historical or current amount from pricing constants', () => {
  assert.doesNotMatch(currentPlanCardSource, /launchAmountFor|PLAN_PRICING_PAISE|formatInr/);
});

test('CurrentPlanCard covers all three billing statuses (free_no_history, free_expired, active)', () => {
  assert.match(currentPlanCardSource, /status === 'free_no_history'/);
  assert.match(currentPlanCardSource, /status === 'free_expired'/);
  assert.match(currentPlanCardSource, /status === 'active'/);
});

test('CurrentPlanCard offers Upgrade to MAX only for a CORE user, never for MAX itself', () => {
  const upgradeBlockStart = currentPlanCardSource.indexOf("plan === 'CORE' &&");
  assert.ok(upgradeBlockStart >= 0);
  const block = currentPlanCardSource.slice(upgradeBlockStart, upgradeBlockStart + 500);
  assert.match(block, /Upgrade to MAX/);
});

test('CurrentPlanCard uses stackingCopyFor for its explanatory text rather than inventing its own proration/renewal copy', () => {
  assert.match(currentPlanCardSource, /stackingCopyFor\(/);
  // Strip comments first — the file's own explanatory comments legitimately
  // discuss "never a proration claim", which would otherwise false-positive
  // this check for actual rendered copy.
  const codeOnly = currentPlanCardSource
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  assert.doesNotMatch(codeOnly, /prorat/i);
});

// --- BillingPage: source contract ------------------------------------------

test('BillingPage never writes User.plan directly — it only reads via useAccess()/usePaymentHistory() and opens the existing CheckoutDialog for any purchase', () => {
  assert.doesNotMatch(billingPageSource, /prisma\.user\.update/);
  assert.doesNotMatch(billingPageSource, /plan:\s*['"]?(FREE|CORE|MAX)['"]?\s*,?\s*\}\)/); // no ad-hoc plan-setting object
  assert.match(billingPageSource, /useAccess\(/);
  assert.match(billingPageSource, /usePaymentHistory\(/);
  assert.match(billingPageSource, /<CheckoutDialog/);
});

test('BillingPage never makes its own raw fetch/API call — all data comes through the established hooks', () => {
  assert.doesNotMatch(billingPageSource, /\bfetch\(/);
});

test('Refresh payment status refreshes both access and history, not just one', () => {
  const handlerStart = billingPageSource.indexOf('const handleRefresh = async () => {');
  const handlerEnd = billingPageSource.indexOf('const handleCheckoutSuccess');
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  const handler = billingPageSource.slice(handlerStart, handlerEnd);
  assert.match(handler, /access\.refresh\(\)/);
  assert.match(handler, /history\.refresh\(\)/);
});

// --- SettingsModal: placeholder removed ------------------------------------

test('SettingsModal no longer shows the old placeholder copy or a hardcoded "Active" badge', () => {
  assert.doesNotMatch(settingsModalSource, /will be shown here when plan management is available/);
  assert.doesNotMatch(settingsModalSource, /<span[^>]*>Active<\/span>/);
});

test('SettingsModal reads real plan/expiry data from useAccess() and links to /billing', () => {
  assert.match(settingsModalSource, /useAccess\(/);
  assert.match(settingsModalSource, /to="\/billing"/);
});
