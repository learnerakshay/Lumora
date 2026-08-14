import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';
import { LumoraBrand } from './LumoraBrand';
import { LANDING_FEATURES } from './landing-content';
import { LegalPage } from '../../pages/LegalPage';

function renderWithRouter(node: React.ReactNode): string {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
}

test('feature grid content model contains exactly nine uniformly shaped entries', () => {
  assert.equal(LANDING_FEATURES.length, 9);
  LANDING_FEATURES.forEach((feature) => {
    assert.ok(feature.icon);
    assert.ok(feature.title.length > 0);
    assert.ok(feature.description.length > 0);
    assert.deepEqual(Object.keys(feature).sort(), ['description', 'icon', 'title']);
  });
});

test('footer legal links resolve to dedicated routes', () => {
  const html = renderWithRouter(<Footer />);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /href="\/contact"/);
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
