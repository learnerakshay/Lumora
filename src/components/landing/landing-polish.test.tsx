import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';
import { LumoraBrand } from './LumoraBrand';
import { LANDING_FEATURES } from './landing-content';
import { LegalPage } from '../../pages/LegalPage';
import { SUPPORT_EMAIL_LABEL, SUPPORT_MAILTO, buildSupportMailto, resolveSupportEmailDestination } from '../../lib/support-config';
import { SUPPORT_SEARCH_ENTRIES, searchSupportContent } from '../../lib/support-search';

const contactPageSource = readFileSync(new URL('../../pages/ContactPage.tsx', import.meta.url), 'utf8');
const reportBugPageSource = readFileSync(new URL('../../pages/ReportBugPage.tsx', import.meta.url), 'utf8');
const spotlightSource = readFileSync(new URL('./SpotlightLauncher.tsx', import.meta.url), 'utf8');

function renderWithRouter(node: React.ReactNode): string {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
}

test('feature grid is curated to five hierarchical entries with consolidated ingestion', () => {
  assert.equal(LANDING_FEATURES.length, 5);
  assert.deepEqual(LANDING_FEATURES.map(({ id }) => id), ['chat', 'citations', 'ingestion', 'privacy', 'streaming']);
  assert.equal(LANDING_FEATURES.filter(({ variant }) => variant === 'hero').length, 2);
  assert.equal(LANDING_FEATURES.filter(({ variant }) => variant === 'supporting').length, 3);
  LANDING_FEATURES.forEach((feature) => {
    assert.ok(feature.icon);
    assert.ok(feature.title.length > 0);
    assert.ok(feature.description.length > 0);
  });
  assert.match(LANDING_FEATURES.find(({ id }) => id === 'ingestion')?.description || '', /PDFs.*websites.*YouTube.*plain text/i);
});

test('footer legal links resolve to dedicated routes', () => {
  const html = renderWithRouter(<Footer />);
  assert.match(html, />Overview</);
  assert.match(html, />Features</);
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /href="\/faq"/);
  assert.match(html, /href="\/about"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /href="\/terms#refunds"/);
  assert.match(html, /href="\/contact"/);
  assert.match(html, /href="\/report-bug"/);
});

test('public footer no longer exposes health diagnostics or engineering architecture', () => {
  const html = renderWithRouter(<Footer />);
  const removedStatusLabel = ['All Systems', 'Operational'].join(' ');
  const removedArchitectureLabel = ['View Engineering', 'Architecture'].join(' ');
  assert.equal(html.includes(removedStatusLabel), false);
  assert.equal(html.includes(removedArchitectureLabel), false);
  assert.doesNotMatch(html, /\/api\/health/);
  assert.doesNotMatch(html, /architecture-drawer/);
  assert.doesNotMatch(spotlightSource, /architecture-drawer|Inspect Architecture|goToArchitectureDrawer/);
});

test('support search ranks real YouTube and billing destinations and returns an honest empty state', () => {
  const youtubeResults = searchSupportContent('YouTube');
  assert.equal(youtubeResults[0]?.id, 'youtube-ingestion');
  assert.ok(youtubeResults.some(({ id }) => id === 'source-processing-problem'));
  assert.ok(youtubeResults.some(({ id }) => id === 'citations'));

  const billingResults = searchSupportContent('billing');
  assert.ok(billingResults.some(({ id }) => id === 'payments-billing'));
  assert.ok(billingResults.some(({ id }) => id === 'plans'));
  assert.deepEqual(searchSupportContent('definitely-not-a-lumora-topic'), []);
  assert.ok(searchSupportContent('source').length <= 6);

  const knownDestinations = new Set([
    '/faq', '/workspaces', '/report-bug', '/skills', '/usage', '/pricing', '/billing', '/sign-in', '/privacy', '/terms',
  ]);
  for (const entry of SUPPORT_SEARCH_ENTRIES) {
    assert.ok(knownDestinations.has(entry.to.split('#')[0]), `unexpected support destination: ${entry.to}`);
  }
});

test('support search keyboard and mouse interactions are wired to real navigation', () => {
  assert.match(contactPageSource, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(contactPageSource, /event\.key === 'ArrowDown'/);
  assert.match(contactPageSource, /event\.key === 'ArrowUp'/);
  assert.match(contactPageSource, /event\.key === 'Enter'/);
  assert.match(contactPageSource, /event\.key === 'Escape'/);
  assert.match(contactPageSource, /onClick=\{\(\) => openSearchResult\(result\)\}/);
  assert.match(contactPageSource, /No support article found\./);
  assert.match(spotlightSource, /location\.pathname === '\/contact'/);
});

test('support email keeps its public label while every mail action uses centralized destination routing', () => {
  assert.equal(SUPPORT_EMAIL_LABEL, 'support@getlumora.in');
  assert.equal(resolveSupportEmailDestination('team@example.com'), 'team@example.com');
  assert.equal(resolveSupportEmailDestination('not-an-email'), resolveSupportEmailDestination());

  const decodedSupportMailto = decodeURIComponent(SUPPORT_MAILTO);
  assert.match(decodedSupportMailto, /^mailto:[^?]+\?subject=Lumora Support Request&body=/);
  assert.match(decodedSupportMailto, /Hi Lumora Support/);
  assert.match(decodedSupportMailto, /Workspace \/ feature involved:/);
  assert.match(contactPageSource, /href=\{SUPPORT_MAILTO\}/);
  assert.match(reportBugPageSource, /buildSupportMailto\(subject, reportText\)/);

  const bugMailto = decodeURIComponent(buildSupportMailto('[Bug] Chat: Example', 'Reproduction details'));
  assert.match(bugMailto, /subject=\[Bug\] Chat: Example/);
  assert.match(bugMailto, /body=Reproduction details/);
});

test('public branding uses the restrained Workspace description', () => {
  const html = renderWithRouter(<LumoraBrand compact />);
  assert.match(html, /AI Knowledge Workspace/);
  assert.doesNotMatch(html, /Knowledge OS|Operating System/);
});

test('legal stub renders real content and a route back to Lumora', () => {
  const html = renderWithRouter(
    <LegalPage eyebrow="Lumora policies" title="Privacy">
      <p>Workspace data remains private.</p>
    </LegalPage>,
  );
  assert.match(html, /<h1[^>]*>Privacy<\/h1>/);
  assert.match(html, /Workspace data remains private/);
  assert.match(html, /href="\/"/);
});
