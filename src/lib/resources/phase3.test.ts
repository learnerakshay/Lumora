import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  CURATED_LEARNING_RESOURCES,
  RESOURCE_CREATORS,
  RESOURCE_ORGANIZATIONS,
  RESOURCE_PROVIDERS,
  canonicalResourceUrl,
  validateResourceRegistry,
} from './catalog';
import type { LearningResource } from './domain';
import type { ResourceDiscoveryProvider } from './discovery';
import { detectResourceIntent, normalizeTopic } from './normalization';
import { clearResourceDiscoveryCache, resolveResources } from './resolver';

const emptyDiscovery: ResourceDiscoveryProvider = { async discover() { return []; } };

function input(prompt: string) {
  const intent = detectResourceIntent(prompt);
  assert.ok(intent, `Expected resource intent: ${prompt}`);
  return { ...intent, workspaceId: 'workspace-1', userId: 'user-1', limit: 5 };
}

beforeEach(() => clearResourceDiscoveryCache());

test('models ChaiCode once as an organization with organization-owned website and Udemy providers', () => {
  assert.deepEqual(RESOURCE_ORGANIZATIONS, [{ id: 'chaicode', name: 'ChaiCode', url: 'https://chaicode.com/' }]);
  const providers = RESOURCE_PROVIDERS.filter((provider) => provider.organizationId === 'chaicode');
  assert.equal(providers.length, 2);
  assert.ok(providers.every((provider) => !('creatorId' in provider) || provider.creatorId === undefined));
  assert.equal(providers.find(({ platform }) => platform === 'Website')?.url, 'https://chaicode.com/');
  assert.equal(RESOURCE_PROVIDERS.filter((provider) => provider.creatorId).length, 4);
  assert.doesNotThrow(() => validateResourceRegistry({
    creators: RESOURCE_CREATORS,
    organizations: RESOURCE_ORGANIZATIONS,
    providers: RESOURCE_PROVIDERS,
    resources: CURATED_LEARNING_RESOURCES,
  }));
});

test('keeps all eight cohorts distinct despite their shared verified provider-fallback URL', async () => {
  const cohorts = CURATED_LEARNING_RESOURCES.filter(({ type }) => type === 'cohort');
  assert.equal(cohorts.length, 8);
  assert.equal(cohorts.filter(({ deliveryMode }) => deliveryMode === 'LIVE').length, 1);
  assert.equal(cohorts.find(({ deliveryMode }) => deliveryMode === 'LIVE')?.id, 'chaicode-genai-js-cohort');
  assert.equal(cohorts.filter(({ deliveryMode }) => deliveryMode === 'RECORDED').length, 7);
  assert.ok(cohorts.every(({ url, linkMode, accessType }) =>
    url === 'https://chaicode.com/' && linkMode === 'PROVIDER_FALLBACK' && accessType === 'paid'));

  const results = await resolveResources(input('Is there a good cohort for System Design?'), { discovery: emptyDiscovery });
  assert.equal(results[0].resource.id, 'chaicode-system-design-cohort');
  const live = await resolveResources(input('I want a live GenAI JavaScript cohort'), { discovery: emptyDiscovery });
  assert.equal(live[0].resource.id, 'chaicode-genai-js-cohort');
  assert.ok(live.some(({ resource }) => resource.id === 'chaicode-genai-python-cohort'));
});

test('free-only intent excludes paid cohorts and courses while paid intent boosts but does not make access a quality score', async () => {
  const free = await resolveResources(input('Give me only free resources to learn Docker'), { discovery: emptyDiscovery });
  assert.ok(free.length > 0);
  assert.ok(free.every(({ resource }) => resource.accessType === 'free'));

  const paid = await resolveResources(input('Recommend a paid structured course for backend'), { discovery: emptyDiscovery });
  assert.equal(paid[0].resource.accessType, 'paid');

  const neutral = await resolveResources(input('Recommend backend learning resources'), { discovery: emptyDiscovery });
  assert.ok(neutral.some(({ resource }) => resource.accessType === 'free'));
});

test('adds exactly the three confirmed interview products and differentiates interview from foundational CN intent', async () => {
  const products = CURATED_LEARNING_RESOURCES.filter(({ type }) => type === 'digital-product');
  assert.equal(products.length, 3);
  assert.deepEqual(new Set(products.flatMap(({ topics }) => topics)),
    new Set(['computer-networks', 'operating-systems', 'dbms']));
  assert.ok(products.every(({ useCases, url, linkMode }) =>
    useCases.length === 1 && useCases[0] === 'interview-prep' &&
    url === 'https://chaicode.com/' && linkMode === 'PROVIDER_FALLBACK'));
  assert.ok(CURATED_LEARNING_RESOURCES.every(({ title }) => !/unnamed|fourth interview/i.test(title)));

  const interview = await resolveResources(input('I need Computer Networks interview preparation resources'), { discovery: emptyDiscovery });
  assert.equal(interview[0].resource.id, 'chaicode-computer-networking-interview-product');
  const foundational = await resolveResources(input('Where should I learn Computer Networks from scratch?'), { discovery: emptyDiscovery });
  assert.equal(foundational[0].resource.id, 'chai-aur-computer-network');
  const os = await resolveResources(input('I need Operating Systems resources for interview preparation'), { discovery: emptyDiscovery });
  assert.ok(os.some(({ resource }) => resource.id === 'chaicode-operating-systems-interview-product'));
});

test('stores exactly six verified Udemy identities with canonical URLs and exact separate offers', () => {
  const udemy = CURATED_LEARNING_RESOURCES.filter(({ providerId }) => providerId === 'chaicode-udemy');
  assert.equal(udemy.length, 6);
  const expectedOffers = new Set([
    'https://udemy.com/course/web-dev-master/?referralCode=4F744D1473CEDE3B10CF&couponCode=KEEPLEARNING',
    'https://udemy.com/course/100-days-of-python/?referralCode=29DE137BD4CAB2506AF4&couponCode=KEEPLEARNING',
    'https://udemy.com/course/full-stack-ai-with-python/?referralCode=9FB677774173802C7752&couponCode=KEEPLEARNING',
    'https://udemy.com/course/complete-react-and-nextjs-course-with-ai-powered-projects/?referralCode=5D1CF9FB4ABFED92B037&couponCode=KEEPLEARNING',
    'https://udemy.com/course/nodejs-backend/?referralCode=6AD0C798E808E506CC1A&couponCode=KEEPLEARNING',
    'https://udemy.com/course/docker-and-kubernetes-for-beginners-devops-journey/?referralCode=E03A8962469A937D9AB5&couponCode=KEEPLEARNING',
  ]);
  assert.deepEqual(new Set(udemy.map(({ offer }) => offer?.url)), expectedOffers);
  for (const course of udemy) {
    assert.equal(course.type, 'course');
    assert.equal(course.accessType, 'paid');
    assert.equal(course.canonicalUrl, course.url);
    assert.equal(canonicalResourceUrl(course.offer!.url), canonicalResourceUrl(course.canonicalUrl!));
  }
  assert.ok(CURATED_LEARNING_RESOURCES.every(({ title }) => title !== 'DSA for Tech Interviews'));
});

test('Udemy canonicalization collapses referral and coupon variants without changing the course path', () => {
  const a = 'https://udemy.com/course/nodejs-backend/?referralCode=one&couponCode=two';
  const b = 'https://udemy.com/course/nodejs-backend/?couponCode=three';
  assert.equal(canonicalResourceUrl(a), canonicalResourceUrl(b));
  assert.equal(canonicalResourceUrl(a), 'https://udemy.com/course/nodejs-backend');
  assert.equal(
    canonicalResourceUrl('https://www.udemy.com/course/nodejs-backend/?couponCode=three'),
    'https://udemy.com/course/nodejs-backend',
  );

  const resources = structuredClone(CURATED_LEARNING_RESOURCES) as LearningResource[];
  const duplicate = structuredClone(resources.find(({ id }) => id === 'chaicode-udemy-nodejs-backend')!);
  duplicate.id = 'duplicate-node-course';
  duplicate.url = b;
  duplicate.canonicalUrl = b;
  duplicate.offer = undefined;
  resources.push(duplicate);
  assert.throws(() => validateResourceRegistry({
    creators: RESOURCE_CREATORS,
    organizations: RESOURCE_ORGANIZATIONS,
    providers: RESOURCE_PROVIDERS,
    resources,
  }), /Duplicate resource URL/);
});

test('cross-origin Udemy duplicates collapse to the curated course with verified metadata', async () => {
  const discovered = {
    title: 'Complete React and NextJS course with AI powered Projects - Udemy',
    url: 'https://www.udemy.com/course/complete-react-and-nextjs-course-with-ai-powered-projects/?couponCode=other',
    snippet: 'A React and Next.js course with AI powered projects.',
    score: 0.99,
  };
  const results = await resolveResources(
    input('Recommend a good paid Udemy course for React and Next.js with projects.'),
    { discovery: { async discover() { return [discovered]; } } },
  );
  const matching = results.filter(({ resource }) =>
    canonicalResourceUrl(resource.url) === canonicalResourceUrl(discovered.url));
  assert.equal(matching.length, 1);
  assert.equal(matching[0].resource.id, 'chaicode-udemy-react-nextjs-ai');
  assert.equal(matching[0].resource.accessType, 'paid');
  assert.equal(matching[0].creatorName, 'Hitesh Choudhary + Suraj Jha');
});

test('verified exact provider/type/topic matches take priority without a creator-specific rule', async () => {
  const youtube = await resolveResources(input('Best YouTube series to learn JavaScript.'), { discovery: emptyDiscovery });
  assert.equal(youtube[0].resource.id, 'hitesh-javascript-playlist');

  const udemy = await resolveResources(input('Best Udemy course for web development.'), { discovery: emptyDiscovery });
  assert.equal(udemy[0].resource.id, 'chaicode-udemy-web-development');

  const cohort = await resolveResources(input('Is there a good GenAI JavaScript cohort?'), { discovery: emptyDiscovery });
  assert.equal(cohort[0].resource.id, 'chaicode-genai-js-cohort');
});

test('registry rejects invalid organization ownership, fallback destinations, and offer identity', () => {
  const base = () => ({
    creators: structuredClone(RESOURCE_CREATORS),
    organizations: structuredClone(RESOURCE_ORGANIZATIONS),
    providers: structuredClone(RESOURCE_PROVIDERS),
    resources: structuredClone(CURATED_LEARNING_RESOURCES) as LearningResource[],
  });
  const owner = base();
  owner.providers.find(({ id }) => id === 'chaicode-website')!.organizationId = 'missing';
  assert.throws(() => validateResourceRegistry(owner), /invalid owner/);

  const fallback = base();
  fallback.resources.find(({ id }) => id === 'chaicode-system-design-cohort')!.url = 'https://example.com/';
  assert.throws(() => validateResourceRegistry(fallback), /invalid provider fallback/);

  const offer = base();
  offer.resources.find(({ id }) => id === 'chaicode-udemy-nodejs-backend')!.offer!.url =
    'https://udemy.com/course/a-different-course/?couponCode=wrong';
  assert.throws(() => validateResourceRegistry(offer), /invalid offer metadata/);
});

test('preserves truthful multi-instructor identity and alias relationships without duplicate courses', async () => {
  const creator = (id: string) => RESOURCE_CREATORS.find((item) => item.id === id)!;
  assert.notEqual(creator('piyush-garg').id, creator('piyush-sachdeva').id);
  assert.ok(creator('suraj-jha').aliases?.includes('Suraj Kumar Jha'));

  const web = CURATED_LEARNING_RESOURCES.find(({ id }) => id === 'chaicode-udemy-web-development')!;
  assert.equal(web.creatorId, 'hitesh-choudhary');
  assert.deepEqual(web.additionalCreatorIds, undefined);
  assert.deepEqual(CURATED_LEARNING_RESOURCES.find(({ id }) => id === 'chaicode-udemy-agentic-ai-python')?.additionalCreatorIds, ['piyush-garg']);
  assert.deepEqual(CURATED_LEARNING_RESOURCES.find(({ id }) => id === 'chaicode-udemy-react-nextjs-ai')?.additionalCreatorIds, ['suraj-jha']);
  assert.deepEqual(CURATED_LEARNING_RESOURCES.find(({ id }) => id === 'chaicode-udemy-docker-kubernetes')?.additionalCreatorIds, ['piyush-sachdeva']);

  const results = await resolveResources(input('Best Udemy Docker Kubernetes course for a beginner?'), { discovery: emptyDiscovery });
  assert.equal(results[0].resource.id, 'chaicode-udemy-docker-kubernetes');
  assert.equal(results[0].creatorName, 'Hitesh Choudhary + Piyush Sachdeva');
  assert.equal(results.filter(({ resource }) => resource.id === results[0].resource.id).length, 1);
});

test('inactive or absent offer metadata never removes the canonical course', async () => {
  const resources = structuredClone(CURATED_LEARNING_RESOURCES) as LearningResource[];
  const node = resources.find(({ id }) => id === 'chaicode-udemy-nodejs-backend')!;
  node.offer!.status = 'INACTIVE';
  const python = resources.find(({ id }) => id === 'chaicode-udemy-python-bootcamp')!;
  python.offer = undefined;
  const results = await resolveResources(input('Best Udemy course for Node backend?'), { discovery: emptyDiscovery, resources });
  assert.equal(results[0].resource.id, node.id);
  assert.equal(results[0].resource.url, node.canonicalUrl);
});

test('extracts bounded Phase-3 access, platform, cohort, delivery, and taxonomy intent', () => {
  assert.deepEqual(
    detectResourceIntent('I want a live GenAI JavaScript cohort'),
    {
      query: 'I want a live GenAI JavaScript cohort',
      topics: ['generative-ai', 'javascript'],
      useCase: 'roadmap',
      resourceType: 'cohort',
      deliveryMode: 'LIVE',
    },
  );
  const udemy = detectResourceIntent('Recommend a paid Udemy course for Node.js backend');
  assert.equal(udemy?.accessType, 'paid');
  assert.equal(udemy?.platform, 'Udemy');
  assert.equal(udemy?.resourceType, 'course');
  assert.equal(normalizeTopic('genai'), 'generative-ai');
  assert.equal(normalizeTopic('node.js'), 'nodejs');
  assert.equal(normalizeTopic('system design'), 'system-design');
  assert.equal(normalizeTopic('k8s'), 'kubernetes');
});

test('cross-phase registry counts, logical grouping, origins, and archived filtering remain intact', async () => {
  assert.equal(CURATED_LEARNING_RESOURCES.length, 69);
  assert.equal(CURATED_LEARNING_RESOURCES.filter(({ creatorId }) => creatorId === 'hitesh-choudhary').length, 26);
  assert.equal(CURATED_LEARNING_RESOURCES.filter(({ creatorId }) => creatorId === 'piyush-garg').length, 24);
  assert.equal(CURATED_LEARNING_RESOURCES.filter(({ creatorId }) => creatorId === 'suraj-jha').length, 8);
  assert.equal(CURATED_LEARNING_RESOURCES.filter(({ seriesId }) => seriesId === 'takeuforward-clone').length, 2);
  assert.equal(CURATED_LEARNING_RESOURCES.filter(({ linkMode }) => linkMode === 'PROVIDER_FALLBACK').length, 11);
  assert.equal(CURATED_LEARNING_RESOURCES.filter(({ status }) => status === 'ARCHIVED').length, 0);
  assert.ok(CURATED_LEARNING_RESOURCES.every(({ sourceOrigin }) => sourceOrigin === 'CURATED'));
  assert.equal(69 - 1, 68, 'The two TakeUForward records represent one logical concept.');

  const archived = structuredClone(CURATED_LEARNING_RESOURCES) as LearningResource[];
  archived.find(({ id }) => id === 'chaicode-system-design-cohort')!.status = 'ARCHIVED';
  const results = await resolveResources(input('Is there a good cohort for System Design?'), { discovery: emptyDiscovery, resources: archived });
  assert.ok(results.every(({ resource }) => resource.id !== 'chaicode-system-design-cohort'));
});
