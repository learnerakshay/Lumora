import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURATED_LEARNING_RESOURCES,
  RESOURCE_CREATORS,
  RESOURCE_ORGANIZATIONS,
  RESOURCE_PROVIDERS,
  ResourceRegistryValidationError,
  validateResourceRegistry,
} from './catalog';
import type { LearningResource } from './domain';

function registry(
  resources: LearningResource[] = structuredClone(CURATED_LEARNING_RESOURCES) as LearningResource[],
) {
  return {
    creators: structuredClone(RESOURCE_CREATORS) as Array<(typeof RESOURCE_CREATORS)[number]>,
    organizations: structuredClone(RESOURCE_ORGANIZATIONS) as Array<(typeof RESOURCE_ORGANIZATIONS)[number]>,
    providers: structuredClone(RESOURCE_PROVIDERS) as Array<(typeof RESOURCE_PROVIDERS)[number]>,
    resources,
  };
}

function rejects(mutator: (data: ReturnType<typeof registry>) => void) {
  const data = registry();
  mutator(data);
  assert.throws(
    () => validateResourceRegistry(data),
    (error: unknown) => error instanceof ResourceRegistryValidationError,
  );
}

test('keeps the complete Phase-1 and Phase-2 catalogs intact while registering Phase 3', () => {
  assert.doesNotThrow(() => validateResourceRegistry(registry()));
  assert.equal(RESOURCE_CREATORS.length, 4);
  assert.equal(RESOURCE_ORGANIZATIONS.length, 1);
  assert.equal(RESOURCE_PROVIDERS.length, 6);
  assert.equal(CURATED_LEARNING_RESOURCES.length, 69);
  assert.equal(CURATED_LEARNING_RESOURCES.filter(({ creatorId }) => creatorId === 'hitesh-choudhary').length, 26);
  assert.equal(CURATED_LEARNING_RESOURCES.filter(({ providerId }) => providerId === 'hitesh-choudhary-english').length, 6);
  assert.equal(CURATED_LEARNING_RESOURCES.filter(({ providerId }) => providerId === 'chai-aur-code-hindi').length, 14);
  assert.equal(RESOURCE_PROVIDERS.find(({ id }) => id === 'chai-aur-code-hindi')?.url, undefined);
});

test('rejects duplicate IDs, duplicate canonical URLs, and malformed URLs', () => {
  rejects(({ resources }) => { resources[1].id = resources[0].id; });
  rejects(({ resources }) => { resources[1].url = resources[0].url; });
  rejects(({ resources }) => { resources[0].url = 'not-a-url'; });
});

test('rejects unknown taxonomy and invalid enum values', () => {
  rejects(({ resources }) => { resources[0].topics = ['quantum-computing' as never]; });
  rejects(({ resources }) => { resources[0].useCases = ['watch-later' as never]; });
  rejects(({ resources }) => { resources[0].accessType = 'trial' as never; });
  rejects(({ resources }) => { resources[0].status = 'DRAFT' as never; });
  rejects(({ resources }) => { resources[0].language = 'fr' as never; });
  rejects(({ resources }) => { resources[0].sourceOrigin = 'DISCOVERED' as never; });
  rejects(({ providers }) => { providers[0].platform = 'Podcast' as never; });
  rejects(({ resources }) => { resources[0].seriesId = 'Invalid Series'; });
});

test('rejects missing creator/provider, ownership mismatch, and platform/domain mismatch', () => {
  rejects(({ resources }) => { resources[0].creatorId = 'missing'; });
  rejects(({ resources }) => { resources[0].providerId = 'missing'; });
  rejects((data) => {
    data.creators.push({ id: 'other', name: 'Other' });
    data.resources[0].creatorId = 'other';
  });
  rejects(({ resources }) => { resources[0].url = 'https://example.com/course'; });
  rejects(({ resources }) => { resources[0].url = 'https://youtube.com/@channel'; });
});
