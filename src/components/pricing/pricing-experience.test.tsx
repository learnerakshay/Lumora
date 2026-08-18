// PlanComparisonTable has no auth dependency, so it is rendered for real
// via renderToStaticMarkup (same pattern as landing-polish.test.tsx).
// PricingCards / PricingSection / PricingPage all call useAuth()/useAccess()
// internally, which require a live Clerk instance AuthProvider wraps — not
// available under Node's test runner (no DOM, no browser, no Clerk
// credentials to boot against). Per CLAUDE.md's documented convention for
// components with no jsdom/RTL setup, their behavioral contract is instead
// verified by reading the component source as text and asserting on it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanComparisonTable } from './PlanComparisonTable';
import { PLAN_LIMITS, PLAN_NAMES, USAGE_ACTION_TYPES } from '../../lib/usage/config';

const FORBIDDEN_COPY = /\b(subscription|cancel anytime|auto-renew(al)?|billed annually|\/month\b|monthly)\b/i;

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const pricingCardsSource = readSource('./PricingCards.tsx');
const pricingSectionSource = readSource('../pricing/PricingSection.tsx');
const pricingPageSource = readSource('../../pages/PricingPage.tsx');
const checkoutDialogSource = readSource('../payments/CheckoutDialog.tsx');

test('PlanComparisonTable renders every real PLAN_LIMITS value for all three plans', () => {
  const html = renderToStaticMarkup(<PlanComparisonTable />);
  for (const plan of PLAN_NAMES) {
    for (const action of USAGE_ACTION_TYPES) {
      const value = String(PLAN_LIMITS[plan][action]);
      assert.match(html, new RegExp(`>${value}<`), `expected ${plan}/${action} value ${value} to appear in the table`);
    }
  }
});

test('PlanComparisonTable states the rolling 12-hour window and the shared-capability explanation', () => {
  const html = renderToStaticMarkup(<PlanComparisonTable />);
  assert.match(html, /rolling 12-hour window/);
  assert.match(html, /Every Lumora capability is available on every plan/);
});

test('PlanComparisonTable renders one checkmark per capability row per plan (no plan is silently excluded)', () => {
  const html = renderToStaticMarkup(<PlanComparisonTable />);
  const checkCount = (html.match(/Included on (Free|Core|Max)/g) || []).length;
  // 15 shared-capability rows (see SHARED_CAPABILITY_ROWS) x 3 plans.
  assert.equal(checkCount, 15 * 3);
});

test('PlanComparisonTable contains no forbidden subscription/auto-renewal wording', () => {
  const html = renderToStaticMarkup(<PlanComparisonTable />);
  assert.doesNotMatch(html, FORBIDDEN_COPY);
});

test('PricingCards badges only CORE as Most popular, and derives it from card.badge rather than a hardcoded plan check', () => {
  assert.match(pricingCardsSource, /card\.badge === 'Most popular'/);
  assert.doesNotMatch(pricingCardsSource, /plan === 'CORE'/);
});

test('PricingCards paid CTA routes signed-out users to sign-in with a return-to-pricing redirect', () => {
  assert.match(pricingCardsSource, /to="\/sign-in\?redirect=\/pricing"/);
});

test('PricingCards FREE CTA never routes through checkout — it only ever links to sign-in or Workspaces', () => {
  const freeCtaStart = pricingCardsSource.indexOf('if (!card.isPaid) {');
  const freeCtaEnd = pricingCardsSource.indexOf('if (!isSignedIn) {');
  assert.ok(freeCtaStart >= 0 && freeCtaEnd > freeCtaStart);
  const freeCtaBlock = pricingCardsSource.slice(freeCtaStart, freeCtaEnd);
  assert.match(freeCtaBlock, /to="\/workspaces"/);
  assert.match(freeCtaBlock, /to="\/sign-in"/);
  assert.doesNotMatch(freeCtaBlock, /onSelectPaid/);
});

test('PricingCards renders limits by iterating card.limits, never a hardcoded per-plan number map', () => {
  // A blind digit scan isn't viable here (Tailwind classes like
  // `shadow-cyan-500/15` collide with real plan-limit values such as 15).
  // Instead assert the structural fact that actually prevents drift: every
  // limit rendered comes from iterating the PlanCard's own `limits` object
  // (itself sourced from PLAN_LIMITS via pricing-presentation.ts), and the
  // file never declares its own CORE/MAX-keyed number map.
  assert.match(pricingCardsSource, /Object\.entries\(card\.limits\)/);
  assert.doesNotMatch(pricingCardsSource, /CORE:\s*\d|MAX:\s*\d|FREE:\s*\d/);
});

test('PricingSection and PricingPage both render the shared PricingCards + PlanComparisonTable pair, not a second implementation', () => {
  for (const source of [pricingSectionSource, pricingPageSource]) {
    assert.match(source, /<PricingCards/);
    assert.match(source, /<PlanComparisonTable/);
  }
});

test('PricingSection exposes a real #pricing landing anchor', () => {
  assert.match(pricingSectionSource, /id="pricing"/);
});

test('PricingSection contains no forbidden subscription/auto-renewal wording', () => {
  // PricingSection is pure marketing card/table copy — unlike PricingPage's
  // FAQ, it never needs to raise (even to deny) subscription/auto-renewal
  // language at all.
  assert.doesNotMatch(pricingSectionSource, FORBIDDEN_COPY);
});

test('PricingPage FAQ never claims a subscription-style term that is actually false, and only ever raises subscription/auto-renewal to explicitly deny it', () => {
  // "cancel anytime" / "billed monthly" / "billed annually" would be
  // outright false claims for a one-time, non-recurring purchase — these
  // must never appear in any form, negated or not.
  assert.doesNotMatch(pricingPageSource, /\bcancel anytime\b/i);
  assert.doesNotMatch(pricingPageSource, /\bbilled (monthly|annually)\b/i);
  assert.doesNotMatch(pricingPageSource, /\$\d/);
  // "subscription" and "auto-renewal" DO appear in the FAQ, but only to
  // honestly deny them — every occurrence must be adjacent to a negation.
  const subscriptionMentions = pricingPageSource.match(/.{0,25}subscription.{0,10}/gi) || [];
  assert.ok(subscriptionMentions.length > 0, 'expected the FAQ to address the subscription question at all');
  for (const mention of subscriptionMentions) {
    assert.match(mention, /not|no\b|Is this a/i, `expected "${mention}" to deny/question being a subscription`);
  }
  const autoRenewMentions = pricingPageSource.match(/.{0,15}auto-renewal.{0,5}/gi) || [];
  assert.ok(autoRenewMentions.length > 0, 'expected the FAQ to address auto-renewal at all');
  for (const mention of autoRenewMentions) {
    assert.match(mention, /no\b/i, `expected "${mention}" to deny auto-renewal`);
  }
});

test('PricingPage states one-time-payment / access-days / no-auto-renewal via the shared ACCESS_TERMS_LABEL, not its own copy', () => {
  assert.match(pricingPageSource, /ACCESS_TERMS_LABEL/);
});

test('CheckoutDialog never restricts Razorpay payment methods — no `method:` option is passed to Razorpay Checkout', () => {
  const optionsStart = checkoutDialogSource.indexOf('const options: RazorpayCheckoutOptions');
  const optionsEnd = checkoutDialogSource.indexOf('const rzp = new window.Razorpay(options);');
  assert.ok(optionsStart >= 0 && optionsEnd > optionsStart);
  const optionsBlock = checkoutDialogSource.slice(optionsStart, optionsEnd);
  assert.doesNotMatch(optionsBlock, /\bmethod\s*:/);
});
