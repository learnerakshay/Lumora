import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { WebSource } from '../ai/types';
import { CURATED_LEARNING_RESOURCES } from './catalog';
import type { LearningResource } from './domain';
import type { ResourceDiscoveryProvider } from './discovery';
import { detectResourceIntent } from './normalization';
import {
  clearResourceDiscoveryCache,
  normalizeDiscoveredResource,
  resolveResources,
} from './resolver';

const emptyDiscovery: ResourceDiscoveryProvider = {
  async discover() { return []; },
};

function discovery(results: WebSource[]): ResourceDiscoveryProvider {
  return { async discover() { return results; } };
}

function webSource(index: number, overrides: Partial<WebSource> = {}): WebSource {
  return {
    title: `Independent learning course ${index}`,
    url: `https://learning.example.com/course-${index}`,
    snippet: `A substantial structured learning resource number ${index}.`,
    score: 0.9 - index * 0.01,
    ...overrides,
  };
}

function input(prompt: string) {
  const intent = detectResourceIntent(prompt);
  assert.ok(intent, `Expected resource intent: ${prompt}`);
  return {
    ...intent,
    workspaceId: 'workspace-1',
    userId: 'user-1',
    limit: 4,
  };
}

beforeEach(() => clearResourceDiscoveryCache());

test('curated matching finds the verified resources for core Phase-1 topics', async () => {
  const cases = [
    ['Give me JavaScript learning resources', 'hitesh-javascript-playlist'],
    ['Recommend a React course', 'chai-aur-react-projects'],
    ['Recommend a React Native course', 'hitesh-react-native-crash-course'],
    ['Recommend a Next.js full stack project', 'hitesh-nextjs-clerk-neon-full-stack'],
    ['Where should I learn Spring Boot?', 'chai-aur-springboot'],
    ['Recommend a computer networks playlist', 'chai-aur-computer-network'],
  ] as const;
  for (const [prompt, expectedId] of cases) {
    const results = await resolveResources(input(prompt), { discovery: emptyDiscovery });
    assert.ok(results.some(({ resource }) => resource.id === expectedId), prompt);
  }
});

test('Computer Networks preference is generic, strong, and inactive without its target', async () => {
  const broad = [webSource(1), webSource(2), webSource(3)];
  const results = await resolveResources(input('Where should I learn CN? Recommend a good playlist.'), {
    discovery: discovery(broad),
  });
  assert.equal(results[0].resource.id, 'chai-aur-computer-network');

  const archived = structuredClone(CURATED_LEARNING_RESOURCES) as LearningResource[];
  archived.find(({ id }) => id === 'chai-aur-computer-network')!.status = 'ARCHIVED';
  clearResourceDiscoveryCache();
  const withoutTarget = await resolveResources(input('Recommend a computer networking fundamentals course'), {
    discovery: emptyDiscovery,
    resources: archived,
  });
  assert.ok(withoutTarget.every(({ resource }) => resource.id !== 'chai-aur-computer-network'));

  const unrelated = await resolveResources(input('Recommend a Node.js networking project course'), {
    discovery: emptyDiscovery,
  });
  assert.ok(unrelated.every(({ resource }) => resource.id !== 'chai-aur-computer-network'));
});

test('normalizes only actual provider-returned HTTPS URLs as discovered resources', () => {
  const source = webSource(1, { url: 'https://example.com/exact?ref=provider' });
  const normalized = normalizeDiscoveredResource(source, input('Recommend a Rust course'), new Date('2026-08-15T00:00:00Z'));
  assert.equal(normalized?.resource.sourceOrigin, 'DISCOVERED');
  assert.equal(normalized?.resource.url, source.url);
  assert.equal(
    normalizeDiscoveredResource({ ...source, url: 'javascript:alert(1)' }, input('Recommend a Rust course'), new Date()),
    null,
  );
  assert.equal(
    normalizeDiscoveredResource({ ...source, score: 2 }, input('Recommend a Rust course'), new Date()),
    null,
  );
  assert.equal(
    normalizeDiscoveredResource(
      { ...source, url: 'https://youtube.com/@some-channel' },
      input('Recommend a Rust course'),
      new Date(),
    ),
    null,
  );
});

test('provider timeout, malformed output, and empty output fail closed without breaking curated results', async () => {
  const throwing: ResourceDiscoveryProvider = { async discover() { throw new Error('timeout'); } };
  const curatedFallback = await resolveResources(input('I want to learn JavaScript'), { discovery: throwing });
  assert.ok(curatedFallback.length > 0);
  assert.ok(curatedFallback.every(({ resource }) => resource.sourceOrigin === 'CURATED'));

  clearResourceDiscoveryCache();
  const malformed = await resolveResources(input('Recommend a Kotlin course'), {
    discovery: discovery([{ title: '', url: 'not-a-url', snippet: '', score: 2 } as WebSource]),
  });
  assert.deepEqual(malformed, []);
});

test('every resolver output has registry or provider provenance and no third origin', async () => {
  const providerResults = [webSource(1), webSource(2), webSource(3)];
  const results = await resolveResources(input('Give me a JavaScript roadmap and resources'), {
    discovery: discovery(providerResults),
  });
  const curatedUrls = new Set(CURATED_LEARNING_RESOURCES.map(({ url }) => url));
  const providerUrls = new Set(providerResults.map(({ url }) => url));
  for (const { resource } of results) {
    assert.ok(resource.sourceOrigin === 'CURATED' || resource.sourceOrigin === 'DISCOVERED');
    assert.equal(
      resource.sourceOrigin === 'CURATED' ? curatedUrls.has(resource.url) : providerUrls.has(resource.url),
      true,
    );
  }
});

test('deduplicates curated and discovery URLs with curated metadata taking precedence', async () => {
  const curated = CURATED_LEARNING_RESOURCES.find(({ id }) => id === 'hitesh-javascript-playlist')!;
  const results = await resolveResources(input('Recommend a JavaScript playlist'), {
    discovery: discovery([
      webSource(1, { title: 'Duplicate JavaScript', url: curated.url }),
      webSource(2),
    ]),
  });
  const duplicates = results.filter(({ resource }) => resource.url === curated.url);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].resource.sourceOrigin, 'CURATED');
});

test('soft composition favors broader diversity without forcing irrelevant curated entries', async () => {
  const broad = [webSource(1), webSource(2), webSource(3), webSource(4)];
  const mixed = await resolveResources(input('Give me JavaScript learning resources'), {
    discovery: discovery(broad),
  });
  assert.ok(mixed.some(({ resource }) => resource.sourceOrigin === 'CURATED'));
  assert.ok(mixed.some(({ resource }) => resource.sourceOrigin === 'DISCOVERED'));
  assert.ok(mixed.filter(({ resource }) => resource.sourceOrigin === 'DISCOVERED').length >= 2);

  clearResourceDiscoveryCache();
  const broaderOnly = await resolveResources(input('Recommend a Kotlin course'), {
    discovery: discovery(broad),
  });
  assert.ok(broaderOnly.length > 0);
  assert.ok(broaderOnly.every(({ resource }) => resource.sourceOrigin === 'DISCOVERED'));
});

test('language, project use-case, and foundational format affect ranking without excluding alternatives', async () => {
  const hindi = await resolveResources(input('Recommend a Hindi JavaScript course'), { discovery: emptyDiscovery });
  assert.equal(hindi[0].resource.language, 'hi');
  assert.ok(hindi.some(({ resource }) => resource.language === 'en'));

  const project = await resolveResources(input('Recommend a full stack Next.js project I can build'), { discovery: emptyDiscovery });
  assert.equal(project[0].resource.useCases.includes('project-proof'), true);

  const foundational = await resolveResources(input('I want to learn JavaScript from the beginning'), { discovery: emptyDiscovery });
  assert.ok(['playlist', 'course'].includes(foundational[0].resource.type));
});
