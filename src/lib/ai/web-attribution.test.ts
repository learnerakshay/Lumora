import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ExternalWebSafeStream,
  externalWebSourcesAppendix,
  sanitizeExternalWebLinks,
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

test('suppresses an unverified model URL without discarding the answer', () => {
  const sanitized = sanitizeExternalWebLinks(
    'Keep this explanation. See [invented course](https://invalid.example/fake).',
    sources,
    [],
  );
  assert.equal(sanitized.text, 'Keep this explanation. See invented course.');
  assert.equal(sanitized.suppressedCount, 1);
  assert.doesNotThrow(() => validateExternalWebLinks(sanitized.text, sources, []));
});

test('preserves verified links while suppressing only the invalid link', () => {
  const sanitized = sanitizeExternalWebLinks(
    'Use [release notes](https://example.com/releases) and [guessed docs](https://invalid.example/docs).',
    sources,
    [],
  );
  assert.match(sanitized.text, /\[release notes\]\(https:\/\/example\.com\/releases\)/);
  assert.match(sanitized.text, /and guessed docs\./);
  assert.doesNotMatch(sanitized.text, /invalid\.example/);
  assert.equal(sanitized.suppressedCount, 1);
});

test('suppresses unverified CommonMark autolinks while preserving verified ones', () => {
  const sanitized = sanitizeExternalWebLinks(
    'Verified <https://example.com/releases>; guessed <https://invalid.example/path>.',
    sources,
    [],
  );
  assert.match(sanitized.text, /<https:\/\/example\.com\/releases>/);
  assert.doesNotMatch(sanitized.text, /invalid\.example/);
  assert.equal(sanitized.suppressedCount, 1);
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

test('stream removes an unverified link and still reaches completion', () => {
  const emitted: string[] = [];
  const suppressed: number[] = [];
  const stream = new ExternalWebSafeStream([], (text) => emitted.push(text), (count) => suppressed.push(count));
  stream.addSources(sources);
  const response = 'Answer survives. [Unknown](https://invalid.example/path)';
  assert.doesNotThrow(() => {
    stream.push(response);
    stream.finish(response);
  });
  assert.equal(emitted.join(''), 'Answer survives. Unknown');
  assert.deepEqual(suppressed, [1]);
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
