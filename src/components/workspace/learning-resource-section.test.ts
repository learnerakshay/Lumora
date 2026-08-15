import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LearningResourceSection } from './LearningResourceSection';
import type { LearningResourceRecommendation } from '../../lib/resources/domain';

const resource: LearningResourceRecommendation = {
  id: 'resource-1',
  title: 'A real learning playlist',
  creator: 'Teacher',
  provider: 'Provider',
  platform: 'YouTube',
  type: 'playlist',
  url: 'https://example.com/playlist',
  reason: 'Structured coverage that fits a learning path.',
  language: 'en',
  level: 'beginner',
  accessType: 'free',
};

test('renders recommendations as optional external links, separate from evidence language', () => {
  const html = renderToStaticMarkup(
    React.createElement(LearningResourceSection, { resources: [resource] }),
  );
  assert.match(html, /Continue learning/);
  assert.match(html, /Optional resources related to your goal/);
  assert.match(html, /href="https:\/\/example\.com\/playlist"/);
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /citation|grounded|Workspace evidence|CURATED|DISCOVERED|score|30%/i);
});

test('renders no section when recommendation resolution returns nothing', () => {
  assert.equal(
    renderToStaticMarkup(React.createElement(LearningResourceSection, { resources: [] })),
    '',
  );
});

test('renders multiple instructors, delivery snapshots, and a restrained offer link without internal metadata', () => {
  const paid: LearningResourceRecommendation = {
    ...resource,
    id: 'course-1',
    title: 'A very long structured course title with several practical projects',
    creator: 'Hitesh Choudhary + Piyush Sachdeva',
    provider: 'ChaiCode on Udemy',
    platform: 'Udemy',
    type: 'course',
    url: 'https://udemy.com/course/example/',
    accessType: 'paid',
    deliveryMode: 'LIVE',
    offer: {
      url: 'https://udemy.com/course/example/?referralCode=verified&couponCode=current',
      label: 'Check current ChaiCode offer',
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(LearningResourceSection, { resources: [paid] }),
  );
  assert.match(html, /Hitesh Choudhary \+ Piyush Sachdeva/);
  assert.match(html, /Live snapshot/);
  assert.match(html, /Check current ChaiCode offer/);
  assert.match(html, /referralCode=verified/);
  assert.doesNotMatch(html, />referralCode|>couponCode|guaranteed|forever/i);
});

test('uses type-specific labels while withholding an unverified access claim', () => {
  const html = renderToStaticMarkup(
    React.createElement(LearningResourceSection, {
      resources: [
        { ...resource, id: 'video', type: 'video', title: 'A direct video' },
        { ...resource, id: 'udemy', platform: 'Udemy', type: 'course', title: 'An unverified Udemy course', accessType: 'unknown' },
        { ...resource, id: 'cohort', platform: 'Cohort', type: 'cohort', title: 'A recorded cohort', deliveryMode: 'RECORDED' },
        { ...resource, id: 'docs', platform: 'Website', type: 'docs', title: 'Official documentation' },
      ],
    }),
  );
  assert.match(html, /Udemy course/);
  assert.match(html, /Recorded/);
  assert.match(html, /Official documentation/);
  assert.doesNotMatch(html, /unknown<\/span>/i);
});
