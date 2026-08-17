import assert from 'node:assert/strict';
import test from 'node:test';
import type { LearningResource, ResolvedLearningResource } from '../resources/domain';
import type { Gap, RoleDefinition } from '../skills/types';
import type { RequiredCompetency } from './types';
import { resolveAllStepResources, resolveStepResources } from './resource-bridge';

const roleDef: RoleDefinition = {
  roleId: 'frontend-react-engineer',
  title: 'Frontend Engineer (React)',
  family: 'frontend',
  requirements: [{ topic: 'react', label: 'React', weight: 3, minEvidenceLevel: 'SHIPPED' }],
  projectArchetypes: [
    { id: 'deployed-react-app', label: 'A deployed, non-tutorial React application', signatureTopics: ['react'] },
  ],
  interviewCompetencies: [{ topic: 'dsa', label: 'Data structures & algorithms' }],
};

function technicalGap(overrides: Partial<Gap> = {}): Gap {
  return {
    id: 'frontend-react-engineer:technical:react',
    roleId: 'frontend-react-engineer',
    category: 'technical-gap',
    ruleId: 'TECHNICAL_SKILL',
    subject: 'React',
    topic: 'react',
    requiredLevel: 'SHIPPED',
    observedLevel: 'NONE',
    severity: 'HIGH',
    evidenceRefs: [],
    rationale: 'test',
    useCase: 'technical-gap',
    ...overrides,
  };
}

const competency: RequiredCompetency = { label: 'React', targetLevel: 'SHIPPED', observedLevel: 'NONE' };

function fakeResource(id: string): ResolvedLearningResource {
  const resource: LearningResource = {
    id,
    title: `Learn ${id}`,
    providerId: 'test-provider',
    type: 'playlist',
    url: `https://example.com/${id}`,
    topics: ['react'],
    level: 'beginner',
    useCases: ['technical-gap'],
    accessType: 'free',
    status: 'ACTIVE',
    verifiedAt: new Date().toISOString(),
    description: 'test resource',
    sourceOrigin: 'CURATED',
  };
  return { resource, creatorName: 'Test Creator', providerName: 'Test Provider', platform: 'YouTube', reason: 'test', score: 1 };
}

test('a gap with a topic resolves through the injected resolver and maps to a recommendation', async () => {
  let capturedInput: unknown;
  const result = await resolveStepResources(
    { gap: technicalGap(), roleDef, competency, planId: 'plan-1', userId: 'user-1', signal: new AbortController().signal },
    {
      resolve: async (input) => {
        capturedInput = input;
        return [fakeResource('r1')];
      },
    },
  );
  assert.equal(result.resourceStatus, 'RESOLVED');
  assert.equal(result.resources.length, 1);
  assert.equal(result.resources[0].title, 'Learn r1');
  assert.deepEqual((capturedInput as { topics: string[] }).topics, ['react']);
  assert.equal((capturedInput as { useCase: string }).useCase, 'technical-gap');
  assert.equal((capturedInput as { level: string }).level, 'beginner');
  assert.equal((capturedInput as { workspaceId: string }).workspaceId, 'learning-plan:plan-1');
});

test('a project archetype gap with no topic falls back to the role catalog signature topics', async () => {
  const archetypeGap = technicalGap({
    id: 'frontend-react-engineer:project:deployed-react-app',
    ruleId: 'PROJECT_EVIDENCE',
    category: 'project-proof',
    subject: 'A deployed, non-tutorial React application',
    topic: null,
    requiredLevel: null,
    observedLevel: null,
    useCase: 'project-proof',
  });
  let capturedTopics: string[] = [];
  await resolveStepResources(
    { gap: archetypeGap, roleDef, competency, planId: 'plan-1', userId: 'user-1', signal: new AbortController().signal },
    {
      resolve: async (input) => {
        capturedTopics = input.topics;
        return [fakeResource('r2')];
      },
    },
  );
  assert.deepEqual(capturedTopics, ['react']);
});

test('a gap with no topic and no matching archetype resolves to NONE without calling the resolver', async () => {
  let called = false;
  const noTopicGap = technicalGap({ topic: null, requiredLevel: null, observedLevel: null, subject: 'Unmapped subject' });
  const result = await resolveStepResources(
    { gap: noTopicGap, roleDef, competency, planId: 'plan-1', userId: 'user-1', signal: new AbortController().signal },
    { resolve: async () => { called = true; return []; } },
  );
  assert.equal(result.resourceStatus, 'NONE');
  assert.deepEqual(result.resources, []);
  assert.equal(called, false);
});

test('a resolver failure is caught closed to an empty, non-throwing result', async () => {
  const result = await resolveStepResources(
    { gap: technicalGap(), roleDef, competency, planId: 'plan-1', userId: 'user-1', signal: new AbortController().signal },
    { resolve: async () => { throw new Error('boom'); } },
  );
  assert.equal(result.resourceStatus, 'NONE');
  assert.deepEqual(result.resources, []);
});

test('advanced observed level maps to an advanced resource level request', async () => {
  let capturedLevel: string | undefined;
  await resolveStepResources(
    {
      gap: technicalGap(),
      roleDef,
      competency: { label: 'React', targetLevel: 'SHIPPED', observedLevel: 'APPLIED' },
      planId: 'plan-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    },
    { resolve: async (input) => { capturedLevel = input.level; return []; } },
  );
  assert.equal(capturedLevel, 'advanced');
});

test('resolveAllStepResources resolves every step independently under one signal', async () => {
  const calls: string[] = [];
  const results = await resolveAllStepResources(
    [
      { gap: technicalGap({ id: 'gap-1' }), roleDef, competency },
      { gap: technicalGap({ id: 'gap-2' }), roleDef, competency },
    ],
    { planId: 'plan-1', userId: 'user-1', signal: new AbortController().signal },
    {
      resolve: async () => {
        calls.push('called');
        return [fakeResource('r')];
      },
    },
  );
  assert.equal(results.length, 2);
  assert.equal(calls.length, 2);
  assert.ok(results.every((result) => result.resourceStatus === 'RESOLVED'));
});

test('one failing step does not affect the others in a bounded batch', async () => {
  const results = await resolveAllStepResources(
    [
      { gap: technicalGap({ id: 'gap-1', topic: 'react' }), roleDef, competency },
      { gap: technicalGap({ id: 'gap-2', topic: 'nodejs', subject: 'Node.js' }), roleDef, competency },
    ],
    { planId: 'plan-1', userId: 'user-1', signal: new AbortController().signal },
    {
      resolve: async (input) => {
        if (input.topics.includes('nodejs')) throw new Error('unexpected failure for this step only');
        return [fakeResource('r')];
      },
    },
  );
  assert.equal(results.length, 2);
  assert.equal(results[0].resourceStatus, 'RESOLVED');
  assert.equal(results[1].resourceStatus, 'NONE');
});
