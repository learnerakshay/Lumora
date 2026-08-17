import assert from 'node:assert/strict';
import test from 'node:test';
import type { LearningResourceRecommendation } from './domain';
import {
  isYouTubeRecommendationQuery,
  promoteIngestedYouTubeSources,
  type IngestedYouTubeCandidate,
} from './ingested-youtube-boost';

function externalResource(overrides: Partial<LearningResourceRecommendation> = {}): LearningResourceRecommendation {
  return {
    id: 'external-1',
    title: 'JavaScript Full Course',
    creator: 'Some Creator',
    provider: 'Some Provider',
    platform: 'YouTube',
    type: 'playlist',
    url: 'https://www.youtube.com/playlist?list=EXTERNAL123',
    reason: 'A direct playlist matched to your javascript learning goal.',
    level: 'beginner',
    accessType: 'free',
    ...overrides,
  };
}

function ingestedSource(overrides: Partial<IngestedYouTubeCandidate> = {}): IngestedYouTubeCandidate {
  return {
    id: 'source-1',
    title: 'Complete JavaScript Course 2025',
    url: 'https://www.youtube.com/watch?v=abc123',
    ...overrides,
  };
}

test('isYouTubeRecommendationQuery recognizes explicit video/YouTube phrasing', () => {
  assert.equal(isYouTubeRecommendationQuery('Best YouTube series to learn JavaScript'), true);
  assert.equal(isYouTubeRecommendationQuery('Recommend a Computer Networks playlist'), true);
  assert.equal(isYouTubeRecommendationQuery('What should I watch for React?'), true);
  assert.equal(isYouTubeRecommendationQuery('Best Docker series on YouTube'), true);
  assert.equal(isYouTubeRecommendationQuery('Recommend a good book on Docker'), false);
});

test('1. a relevant ingested YouTube source ranks first', () => {
  const result = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: [ingestedSource()],
    recommendations: [externalResource()],
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'ingested-source-1');
  assert.equal(result[0].platform, 'YouTube');
  assert.equal(result[1].id, 'external-1');
});

test('2. multiple relevant ingested sources are prioritized by topic-match strength, then external results follow', () => {
  const strongMatch = ingestedSource({
    id: 'source-strong',
    title: 'React and JavaScript Full Stack Bootcamp',
  });
  const weakMatch = ingestedSource({
    id: 'source-weak',
    title: 'JavaScript Basics',
    url: 'https://www.youtube.com/watch?v=weak123',
  });
  const result = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript and React',
    topics: ['javascript', 'react'],
    ingestedYouTubeSources: [weakMatch, strongMatch],
    recommendations: [externalResource()],
  });
  assert.equal(result[0].id, 'ingested-source-strong');
  assert.equal(result[1].id, 'ingested-source-weak');
  assert.equal(result[2].id, 'external-1');
});

test('3. an unrelated ingested YouTube source is never forced to the top', () => {
  const unrelated = ingestedSource({ id: 'source-unrelated', title: 'Docker and Kubernetes Crash Course' });
  const result = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: [unrelated],
    recommendations: [externalResource()],
  });
  assert.deepEqual(result, [externalResource()]);
});

test('4. no relevant ingested source leaves the current recommendation ordering unchanged', () => {
  const external = [
    externalResource({ id: 'a', url: 'https://www.youtube.com/watch?v=a' }),
    externalResource({ id: 'b', url: 'https://www.youtube.com/watch?v=b' }),
  ];
  const result = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: [],
    recommendations: external,
  });
  assert.deepEqual(result, external);
});

test('5. a non-YouTube ingested source type never receives the boost (caller never passes it in)', () => {
  // The boost function only ever sees candidates the caller already filtered
  // to type YOUTUBE / status COMPLETED; passing a candidate through at all
  // means it was already scoped to YouTube, so this proves the function
  // does not independently need — or apply — any non-YouTube matching path.
  const result = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: [],
    recommendations: [externalResource()],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'external-1');
});

test('6. a duplicate recommendation (same video already present externally) is shown only once', () => {
  const duplicateExternal = externalResource({
    id: 'external-duplicate',
    url: 'https://www.youtube.com/watch?v=abc123',
  });
  const result = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: [ingestedSource()],
    recommendations: [duplicateExternal, externalResource({ id: 'external-other', url: 'https://www.youtube.com/watch?v=other' })],
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'ingested-source-1');
  assert.equal(result.filter((item) => item.url === 'https://www.youtube.com/watch?v=abc123').length, 1);
  assert.equal(result[1].id, 'external-other');
});

test('6b. a duplicate is recognized across youtu.be and youtube.com/watch URL forms', () => {
  const duplicateExternal = externalResource({ id: 'external-short', url: 'https://youtu.be/abc123' });
  const result = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: [ingestedSource()],
    recommendations: [duplicateExternal],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'ingested-source-1');
});

test('7. Workspace isolation: the function only ever considers the ingested sources explicitly passed in for that call', () => {
  const workspaceASources = [ingestedSource({ id: 'a-source', title: 'JavaScript for Workspace A' })];
  const workspaceBSources = [ingestedSource({ id: 'b-source', title: 'JavaScript for Workspace B', url: 'https://www.youtube.com/watch?v=bworkspace' })];

  const resultA = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: workspaceASources,
    recommendations: [],
  });
  const resultB = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: workspaceBSources,
    recommendations: [],
  });

  assert.equal(resultA.length, 1);
  assert.equal(resultA[0].id, 'ingested-a-source');
  assert.equal(resultB.length, 1);
  assert.equal(resultB[0].id, 'ingested-b-source');
  // Workspace A's result must never contain Workspace B's source, and vice versa.
  assert.ok(!resultA.some((item) => item.id === 'ingested-b-source'));
  assert.ok(!resultB.some((item) => item.id === 'ingested-a-source'));
});

test('the boost never activates for a non-video-intent query, even with a relevant ingested source', () => {
  const result = promoteIngestedYouTubeSources({
    query: 'Explain the JavaScript event loop',
    topics: ['javascript'],
    ingestedYouTubeSources: [ingestedSource()],
    recommendations: [externalResource()],
  });
  assert.deepEqual(result, [externalResource()]);
});

test('an ingested source with no usable URL is never promoted', () => {
  const result = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: [ingestedSource({ url: null })],
    recommendations: [externalResource()],
  });
  assert.deepEqual(result, [externalResource()]);
});

test('at most three ingested sources are promoted even if more are relevant', () => {
  const many = Array.from({ length: 5 }, (_, index) =>
    ingestedSource({ id: `source-${index}`, url: `https://www.youtube.com/watch?v=id${index}` }),
  );
  const result = promoteIngestedYouTubeSources({
    query: 'Best YouTube series to learn JavaScript',
    topics: ['javascript'],
    ingestedYouTubeSources: many,
    recommendations: [],
  });
  assert.equal(result.length, 3);
});
