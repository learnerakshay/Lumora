import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// WorkspaceChatArea has no component-testing setup (no RTL/jsdom in this
// repo), so its behavioral contract is verified by reading the source as
// text, per the pattern already used in chat-presentation.test.ts and
// workspace-interactions.test.ts.
function chatAreaSource(): string {
  return readFileSync(new URL('./WorkspaceChatArea.tsx', import.meta.url), 'utf8');
}

test('GitHub-Flavored Markdown (tables, etc.) is enabled via remark-gfm, not hand-rolled pipe parsing', () => {
  const source = chatAreaSource();

  // react-markdown only supports CommonMark out of the box - GFM tables are
  // a distinct extension that requires remark-gfm explicitly, or `| a | b |`
  // syntax is parsed as a plain paragraph and rendered as literal pipe text.
  assert.match(source, /import remarkGfm from ['"]remark-gfm['"]/);

  // Both Markdown render sites - the completed message and the actively
  // streaming message - must enable it, or tables would render correctly
  // once history reloads but not while streaming (or vice versa).
  const markdownUsages = source.match(/<Markdown\b[^>]*>/g) ?? [];
  assert.equal(markdownUsages.length, 2, 'expected exactly two <Markdown> render sites');
  for (const usage of markdownUsages) {
    assert.match(usage, /remarkPlugins=\{REMARK_PLUGINS\}/);
  }

  // Guard against a manual pipe-character parser being substituted in later.
  assert.doesNotMatch(source, /split\(['"]\|['"]\)/);
});

test('tables render as real markup, not literal text, and stay responsive on narrow screens', () => {
  const source = chatAreaSource();

  // The table/thead/th/td component overrides must exist for react-markdown
  // to have anywhere to render the parsed GFM table AST into.
  assert.match(source, /table:\s*\(\{\s*children[^)]*\)\s*=>/);
  assert.match(source, /thead:\s*\(\{\s*children[^)]*\)\s*=>/);
  assert.match(source, /\bth:\s*\(\{\s*children[^)]*\)\s*=>/);
  assert.match(source, /\btd:\s*\(\{\s*children[^)]*\)\s*=>/);

  // The table must be wrapped in a horizontally-scrollable container so a
  // wide table scrolls within itself instead of breaking the Workspace
  // layout on narrow screens.
  const tableToTheadSpan = source.slice(source.indexOf('table:'), source.indexOf('thead:'));
  assert.ok(tableToTheadSpan.length > 0, 'expected to locate the table component override');
  assert.match(tableToTheadSpan, /overflow-x-auto/);
});

test('GFM support does not introduce raw-HTML rendering or weaken existing citation/XSS protections', () => {
  const source = chatAreaSource();

  // remark-gfm parses structured Markdown extensions through the same safe
  // AST -> React element pipeline react-markdown already uses; it must never
  // be paired with raw HTML passthrough, which would be a real XSS surface.
  assert.doesNotMatch(source, /rehype-raw/);
  assert.doesNotMatch(source, /allowDangerousHtml/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);

  // Inline citation markers must still be rendered through the existing
  // citationChildren pipeline (paragraphs and list items), unaffected by
  // adding remarkGfm to the same components map.
  assert.match(source, /p:\s*\(\{\s*children[^)]*\)\s*=>[\s\S]*?citationChildren\(children\)/);
  assert.match(source, /li:\s*\(\{\s*children[^)]*\)\s*=>[\s\S]*?citationChildren\(children\)/);
});
