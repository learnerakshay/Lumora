import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { toLearningResourceRecommendation, type ResolvedLearningResource } from '../resources/domain';

const route = readFileSync(new URL('../../routes/workspaces.ts', import.meta.url), 'utf8');
const streamRoute = route.slice(route.indexOf("workspaceRouter.post('/:id/chat/stream'"));
const store = readFileSync(new URL('./conversation-store.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../../../prisma/schema.prisma', import.meta.url), 'utf8');

test('chat integration is intent-gated, additive, and cannot add a second usage charge', () => {
  assert.match(streamRoute, /const resourceIntent = actionPlan \? null : detectResourceIntent\(queryText\)/);
  assert.match(streamRoute, /resourceIntent\s*\? resolveResources/);
  assert.match(streamRoute, /Learning resource resolution failed closed/);
  assert.equal((streamRoute.match(/checkAndReserve\(/g) || []).length, 1);
  assert.doesNotMatch(streamRoute, /RESOURCE_SEARCH|RESOURCE_RECOMMENDATION/);
});

test('recommendations persist in an optional additive JSON field across done and reload paths', () => {
  assert.match(schema, /resourceRecommendations Json\?/);
  assert.match(store, /resourceRecommendations: normalizeResourceRecommendations/);
  assert.match(store, /resourceRecommendations: data\.resourceRecommendations/);
  assert.match(streamRoute, /resourceRecommendations,\s*citations: persistedCitations/);
  assert.match(streamRoute, /message: savedAssistantMessage/);
});

test('the public card contract strips origin and score mechanics', () => {
  const resolved: ResolvedLearningResource = {
    resource: {
      id: 'curated-1',
      title: 'Course',
      creatorId: 'creator-1',
      providerId: 'provider-1',
      type: 'course',
      url: 'https://example.com/course',
      topics: ['javascript'],
      level: 'beginner',
      useCases: ['roadmap'],
      accessType: 'free',
      status: 'ACTIVE',
      verifiedAt: '2026-08-15',
      description: 'Course description',
      sourceOrigin: 'CURATED',
    },
    creatorName: 'Creator',
    providerName: 'Provider',
    platform: 'Website',
    reason: 'Relevant to the learning goal.',
    score: 99,
  };
  const publicValue = toLearningResourceRecommendation(resolved);
  assert.equal('sourceOrigin' in publicValue, false);
  assert.equal('score' in publicValue, false);
  assert.equal(publicValue.url, resolved.resource.url);
});
