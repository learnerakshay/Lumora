import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { WebSource } from '../ai/types';
import {
  CURATED_LEARNING_RESOURCES,
  RESOURCE_CREATORS,
  RESOURCE_PROVIDERS,
  canonicalResourceUrl,
} from './catalog';
import type { ResourceDiscoveryProvider } from './discovery';
import { detectResourceIntent } from './normalization';
import { clearResourceDiscoveryCache, resolveResources } from './resolver';

const emptyDiscovery: ResourceDiscoveryProvider = { async discover() { return []; } };

function discovery(count = 4): ResourceDiscoveryProvider {
  return {
    async discover() {
      return Array.from({ length: count }, (_, index): WebSource => ({
        title: `Independent course ${index + 1}`,
        url: `https://independent.example.com/course-${index + 1}`,
        snippet: 'A substantial independent learning resource.',
        score: 0.95 - index * 0.03,
      }));
    },
  };
}

function input(prompt: string, limit = 5) {
  const intent = detectResourceIntent(prompt);
  assert.ok(intent, `Expected resource intent: ${prompt}`);
  return { ...intent, workspaceId: 'workspace-1', userId: 'user-1', limit };
}

beforeEach(() => clearResourceDiscoveryCache());

test('adds exact creator/provider identities with no provisional Suraj duplicate', () => {
  assert.equal(RESOURCE_CREATORS.filter(({ id, name }) => id === 'piyush-garg' && name === 'Piyush Garg').length, 1);
  assert.equal(RESOURCE_CREATORS.filter(({ id, name }) => id === 'suraj-jha' && name === 'Suraj Jha').length, 1);
  assert.ok(RESOURCE_CREATORS.every(({ name }) => name !== 'Suraj Kumar Jha' && name !== 'Suraj Kumar Shah'));
  assert.equal(RESOURCE_PROVIDERS.filter(({ creatorId }) => creatorId === 'piyush-garg').length, 1);
  assert.equal(RESOURCE_PROVIDERS.filter(({ creatorId }) => creatorId === 'suraj-jha').length, 1);
  assert.equal(RESOURCE_PROVIDERS.find(({ creatorId }) => creatorId === 'piyush-garg')?.url, undefined);
  assert.equal(RESOURCE_PROVIDERS.find(({ creatorId }) => creatorId === 'suraj-jha')?.url, undefined);
});

test('registers 24 unique Piyush resources and canonicalizes tracking-only duplicates', () => {
  const resources = CURATED_LEARNING_RESOURCES.filter(({ creatorId }) => creatorId === 'piyush-garg');
  assert.equal(resources.length, 24);
  assert.equal(new Set(resources.map(({ id }) => id)).size, 24);
  assert.equal(new Set(resources.map(({ url }) => canonicalResourceUrl(url))).size, 24);
  assert.equal(
    canonicalResourceUrl('https://youtube.com/playlist?list=PLinedj3B30sDc2woh6XncR9_a310zaAyJ&si=first'),
    canonicalResourceUrl('https://youtube.com/playlist?si=second&list=PLinedj3B30sDc2woh6XncR9_a310zaAyJ'),
  );
  assert.equal(
    canonicalResourceUrl('https://youtube.com/playlist?list=PLinedj3B30sDofFbjtCBqbj2l68UHv5Zr&si=first'),
    canonicalResourceUrl('https://youtube.com/playlist?si=second&list=PLinedj3B30sDofFbjtCBqbj2l68UHv5Zr'),
  );
});

test('preserves 8 Suraj URLs representing 7 concepts and groups TakeUForward without guessing part order', async () => {
  const resources = CURATED_LEARNING_RESOURCES.filter(({ creatorId }) => creatorId === 'suraj-jha');
  assert.equal(resources.length, 8);
  const takeUForward = resources.filter(({ seriesId }) => seriesId === 'takeuforward-clone');
  assert.equal(takeUForward.length, 2);
  assert.deepEqual(new Set(takeUForward.map(({ url }) => url)), new Set([
    'https://youtu.be/yMVdhxixL6U?si=bfKhbplmAJ4mq-Q6',
    'https://youtu.be/xYxYWdP4Fls?si=lBZPFY7LIywk6Poh',
  ]));
  assert.ok(takeUForward.every(({ title }) => !/part\s*[12]/i.test(title)));

  const results = await resolveResources(
    {
      query: 'TakeUForward clone project',
      topics: ['project-building'],
      useCase: 'project-proof',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      limit: 5,
    },
    { discovery: emptyDiscovery, resources: takeUForward },
  );
  assert.equal(results.filter(({ resource }) => resource.seriesId === 'takeuforward-clone').length, 1);
});

test('DEAD Series is strongly scoped to genuine developer-mindset intent', async () => {
  for (const prompt of [
    'How do I develop a developer mindset?',
    'How should I choose a development niche?',
    'How do I stop being a tutorial-only developer?',
  ]) {
    const results = await resolveResources(input(prompt), { discovery: emptyDiscovery });
    assert.equal(results[0].resource.id, 'piyush-dead-series', prompt);
    assert.ok(results.every(({ resource }) => resource.id !== 'hitesh-mindset'));
  }
  assert.equal(detectResourceIntent('Explain Docker containers'), null);
});

test('AI-agent flagships match agent queries without unrelated Piyush resources', async () => {
  const results = await resolveResources(input('I want to learn AI agents with TypeScript. Give me a roadmap and resources.'), {
    discovery: emptyDiscovery,
  });
  const ids = new Set(results.map(({ resource }) => resource.id));
  assert.ok(ids.has('piyush-building-ai-agents-typescript-openai'));
  assert.ok(ids.has('piyush-master-agentic-ai-workflows'));
  assert.ok(
    results
      .filter(({ resource }) => resource.creatorId === 'piyush-garg')
      .every(({ resource }) => resource.topics.includes('ai-agents')),
  );
});

test('project-proof intent favors serious Suraj project work through metadata, not creator identity', async () => {
  const generic = await resolveResources(input('Recommend a serious project for my resume'), {
    discovery: emptyDiscovery,
  });
  assert.ok(generic.length > 0);
  assert.ok(generic.every(({ resource }) => resource.useCases.includes('project-proof')));

  const backend = await resolveResources(input('I need serious backend projects for my resume to prove my skills'), {
    discovery: emptyDiscovery,
  });
  assert.equal(backend[0].resource.id, 'suraj-three-advanced-backend-projects');
  assert.ok(backend[0].resource.useCases.includes('project-proof'));

  const next = await resolveResources(input('I know Next.js. Give me a serious full-stack project to build.'), {
    discovery: emptyDiscovery,
  });
  assert.ok(next[0].resource.useCases.includes('project-proof'));
});

test('foundational and advanced requests distinguish PostgreSQL and Docker resources by metadata', async () => {
  const postgres = await resolveResources(input('I want to learn PostgreSQL from scratch. Give me good resources.'), {
    discovery: emptyDiscovery,
  });
  assert.equal(postgres[0].resource.id, 'suraj-postgresql-complete-beginners');
  assert.equal(postgres[0].resource.level, 'beginner');
  assert.ok(!postgres[0].resource.useCases.includes('project-proof'));

  const beginnerDocker = await resolveResources(input('I am new to Docker. Where should I start?'), {
    discovery: emptyDiscovery,
  });
  assert.equal(beginnerDocker[0].resource.id, 'piyush-docker-beginners');

  const advancedDocker = await resolveResources(input('I already know Docker basics. I want containerisation and deployment properly.'), {
    discovery: emptyDiscovery,
  });
  assert.equal(advancedDocker[0].resource.id, 'piyush-master-docker-containerisation-deployments');
});

test('all Suraj project rows carry project-proof while PostgreSQL remains foundational', () => {
  const resources = CURATED_LEARNING_RESOURCES.filter(({ creatorId }) => creatorId === 'suraj-jha');
  const foundational = resources.find(({ id }) => id === 'suraj-postgresql-complete-beginners');
  assert.ok(foundational);
  assert.ok(!foundational.useCases.includes('project-proof'));
  assert.ok(
    resources
      .filter(({ id }) => id !== foundational.id)
      .every(({ useCases }) => useCases.includes('project-proof')),
  );
});

test('interview, open-source, and framework queries select their specific Phase-2 resources', async () => {
  const jsInterview = await resolveResources(input('Give me resources to prepare for JavaScript interviews.'), { discovery: emptyDiscovery });
  const interviewIds = jsInterview.slice(0, 2).map(({ resource }) => resource.id);
  assert.deepEqual(new Set(interviewIds), new Set([
    'piyush-javascript-interview-questions',
    'piyush-javascript-interview-preparation',
  ]));

  const systemDesign = await resolveResources(input('Recommend a system design interview preparation course'), { discovery: emptyDiscovery });
  assert.equal(systemDesign[0].resource.id, 'piyush-system-design');

  const openSource = await resolveResources(input('I want to start contributing to open source. Where should I learn?'), { discovery: emptyDiscovery });
  assert.deepEqual(new Set(openSource.map(({ resource }) => resource.id)), new Set([
    'piyush-open-source-contributions-guide',
    'piyush-open-source-bootcamp',
  ]));

  for (const [prompt, id] of [
    ['Recommend a Next.js learning course', 'piyush-nextjs-master-course'],
    ['Recommend a Node.js learning course', 'piyush-master-nodejs'],
    ['Recommend a React learning course', 'piyush-master-reactjs'],
  ] as const) {
    const results = await resolveResources(input(prompt), { discovery: emptyDiscovery });
    assert.ok(results.some(({ resource }) => resource.id === id), prompt);
  }
});

test('soft composition retains discovery and prevents unnecessary single-creator domination', async () => {
  for (const prompt of [
    'Recommend a React learning course',
    'I want to learn Docker. Give me resources.',
    'I want to learn AI agents. Give me resources.',
    'I want to learn PostgreSQL. Give me resources.',
    'Recommend a system design interview course',
  ]) {
    clearResourceDiscoveryCache();
    const results = await resolveResources(input(prompt, 4), { discovery: discovery() });
    assert.ok(results.some(({ resource }) => resource.sourceOrigin === 'DISCOVERED'), prompt);
    const creatorCounts = new Map<string, number>();
    for (const { resource } of results.filter(({ resource }) => resource.sourceOrigin === 'CURATED')) {
      creatorCounts.set(resource.creatorId, (creatorCounts.get(resource.creatorId) || 0) + 1);
    }
    assert.ok([...creatorCounts.values()].every((count) => count < 4), prompt);
  }
});

test('unsupported topics remain broader-only and Computer Networks preference remains intact', async () => {
  const unsupported = await resolveResources(input('Recommend a Kotlin learning course'), { discovery: discovery() });
  assert.ok(unsupported.every(({ resource }) => resource.sourceOrigin === 'DISCOVERED'));

  clearResourceDiscoveryCache();
  const networks = await resolveResources(input('Where should I learn Computer Networks? Recommend a playlist.'), {
    discovery: discovery(),
  });
  assert.equal(networks[0].resource.id, 'chai-aur-computer-network');
});
