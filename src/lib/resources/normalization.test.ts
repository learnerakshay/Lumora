import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOCUMENTED_TOPIC_ALIASES,
  detectResourceIntent,
  extractTopics,
  hasLearningResourceIntent,
  normalizeTopic,
} from './normalization';

test('normalizes every documented resource alias deterministically', () => {
  for (const [alias, topic] of Object.entries(DOCUMENTED_TOPIC_ALIASES)) {
    assert.equal(normalizeTopic(alias), topic, alias);
    assert.ok(extractTopics(`Please teach me ${alias}`).includes(topic), alias);
  }
});

test('detects every supplied positive learning/resource example', () => {
  const positives = [
    'I want to learn React',
    'Give me a JavaScript roadmap and resources',
    'Recommend a Go playlist',
    'Where should I learn computer networks?',
    'Best Next.js course?',
    'Give me a full stack project to learn from.',
  ];
  for (const prompt of positives) assert.equal(hasLearningResourceIntent(prompt), true, prompt);
});

test('does not run discovery for explanation, debugging, or definition questions', () => {
  const negatives = [
    'Explain closures',
    'Why is this React component rerendering?',
    'Fix this syntax error',
    'What is a JavaScript promise?',
  ];
  for (const prompt of negatives) assert.equal(detectResourceIntent(prompt), null, prompt);
});

test('derives topic, project use-case, and explicit language without an LLM', () => {
  assert.deepEqual(detectResourceIntent('Recommend a Hindi Next.js full stack project course'), {
    query: 'Recommend a Hindi Next.js full stack project course',
    topics: ['project-building', 'full-stack', 'nextjs'],
    useCase: 'project-proof',
    language: 'hi',
  });
  assert.deepEqual(extractTopics('networking sockets in Node.js'), ['nodejs']);
});

test('derives Phase-2 mindset, project-proof, and level signals narrowly', () => {
  assert.deepEqual(detectResourceIntent('How should I choose a development niche?'), {
    query: 'How should I choose a development niche?',
    topics: ['developer-mindset'],
    useCase: 'developer-mindset',
  });
  assert.equal(detectResourceIntent('I am new to Docker. Where should I start?')?.level, 'beginner');
  assert.equal(detectResourceIntent('I already know Docker basics and want deployment properly')?.level, 'advanced');
  assert.equal(detectResourceIntent('I need serious backend projects for my resume')?.useCase, 'project-proof');
  assert.equal(detectResourceIntent('Explain the JavaScript event loop'), null);
});
