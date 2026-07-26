import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ExternalWebSafeStream,
  externalWebSourcesAppendix,
  validateExternalWebLinks,
} from './web-attribution';

const sources = [
  {
    title: 'Official [release] notes',
    url: 'https://example.com/releases',
    snippet: 'Stable release information.',
    score: 0.9,
  },
];

test('builds a clearly separated external source appendix', () => {
  assert.equal(
    externalWebSourcesAppendix(sources),
    '\n\n---\n\n### External Web Sources\n\n- [Official \\[release\\] notes](https://example.com/releases)',
  );
});

test('rejects links that were not returned by web or Workspace retrieval', () => {
  assert.doesNotThrow(() =>
    validateExternalWebLinks(
      'See [the release](https://example.com/releases).',
      sources,
      [],
    ),
  );
  assert.throws(
    () =>
      validateExternalWebLinks(
        'See [an invented source](https://invalid.example/fake).',
        sources,
        [],
      ),
    /was not retrieved/,
  );
});

test('ignores Markdown link examples inside inline and fenced code', () => {
  assert.doesNotThrow(() =>
    validateExternalWebLinks(
      [
        'Inline: `[label](https://not-retrieved.example/inline)`',
        '```markdown',
        '[label](https://not-retrieved.example/fenced)',
        '```',
      ].join('\n'),
      [],
      [],
    ),
  );
});

test('stream buffers incomplete links and validates before emission', () => {
  const emitted: string[] = [];
  const stream = new ExternalWebSafeStream([], (text) => emitted.push(text));
  stream.addSources(sources);
  stream.push('Current details: [release');
  assert.deepEqual(emitted, ['Current details: ']);
  stream.push(' notes](https://example.com/releases).');
  stream.finish('Current details: [release notes](https://example.com/releases).');
  assert.equal(emitted.join(''), 'Current details: [release notes](https://example.com/releases).');
});

test('stream buffers incomplete code samples before link validation', () => {
  const emitted: string[] = [];
  const stream = new ExternalWebSafeStream([], (text) => emitted.push(text));
  stream.push('Example: `[label](https://not-retrieved.example');
  assert.deepEqual(emitted, ['Example: ']);
  stream.push('/code)` is Markdown.');
  const response =
    'Example: `[label](https://not-retrieved.example/code)` is Markdown.';
  stream.finish(response);
  assert.equal(emitted.join(''), response);
});
