import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AI_MODE_OPTIONS,
  getGenerationStatusLabel,
  getPersistedGenerationStatus,
  getResponseModeDisclosure,
  splitCitationMarkers,
} from './chat-presentation';

test('assistant disclosure is explicit while historical unknown messages stay neutral', () => {
  assert.equal(getResponseModeDisclosure('GENERAL'), 'General knowledge');
  assert.equal(getResponseModeDisclosure('GROUNDED'), 'From your Workspace');
  assert.equal(getResponseModeDisclosure(null), 'Previous response');
});

test('AI mode menu exposes the four existing response modes with concise descriptors', () => {
  assert.deepEqual(AI_MODE_OPTIONS.map((mode) => mode.id), [
    'CONCISE',
    'DETAILED',
    'CRITICAL',
    'CREATIVE',
  ]);
  assert.ok(AI_MODE_OPTIONS.every((mode) => mode.description.length > 0));
});

test('fresh composer and application fallbacks default coherently to Concise', () => {
  const composer = readFileSync(new URL('./WorkspacePromptComposer.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../../pages/WorkspaceDetailPage.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../../routes/workspaces.ts', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../../lib/chat/conversation-store.ts', import.meta.url), 'utf8');
  const rag = readFileSync(new URL('../../lib/retrieval/rag-service.ts', import.meta.url), 'utf8');
  assert.match(composer, /useState<AnswerMode>\('CONCISE'\)/);
  assert.match(page, /mode: AnswerMode = 'CONCISE'/);
  assert.match(route, /mode: requestedMode = 'CONCISE'/);
  assert.match(store, /mode: data\.mode \|\| 'CONCISE'/);
  assert.match(rag, /_mode: 'CONCISE' \| 'DETAILED' \| 'CRITICAL' \| 'CREATIVE' = 'CONCISE'/);
  assert.doesNotMatch(composer, /useState<AnswerMode>\('DETAILED'\)/);
});

test('citation marker presentation preserves citation numbering and surrounding text', () => {
  assert.deepEqual(splitCitationMarkers('Answer [Citation #1] and [Citation #12].'), [
    { type: 'text', value: 'Answer ' },
    { type: 'citation', value: '[Citation #1]', citationNumber: 1 },
    { type: 'text', value: ' and ' },
    { type: 'citation', value: '[Citation #12]', citationNumber: 12 },
    { type: 'text', value: '.' },
  ]);
});

test('ordinary response text remains unchanged', () => {
  assert.deepEqual(splitCitationMarkers('No marker here.'), [
    { type: 'text', value: 'No marker here.' },
  ]);
});

test('generation labels truthfully distinguish every real AI Action', () => {
  const actionIds = [
    'summarize',
    'explain',
    'compare',
    'generate_notes',
    'key_takeaways',
  ] as const;
  const labels = actionIds.map((actionId) =>
    getGenerationStatusLabel({ actionId, mode: 'DETAILED' }),
  );
  assert.equal(new Set(labels).size, 5);
  assert.match(labels[0], /Summarizing/);
  assert.match(labels[1], /explanation/);
  assert.match(labels[2], /Comparing/);
  assert.match(labels[3], /notes/);
  assert.match(labels[4], /takeaways/);
});

test('generation labels use the latest of all four modes without stale copy', () => {
  const labelsContainMode = AI_MODE_OPTIONS.map(({ id, label }) =>
    getGenerationStatusLabel({ actionId: 'summarize', mode: id }).includes(`${label} mode`),
  );
  assert.deepEqual(labelsContainMode, [true, true, true, true]);
  assert.notEqual(
    getGenerationStatusLabel({ actionId: 'explain', mode: 'CONCISE' }),
    getGenerationStatusLabel({ actionId: 'compare', mode: 'CREATIVE' }),
  );
});

test('persisted SENDING turn restores its Action and Mode status metadata', () => {
  const recovered = getPersistedGenerationStatus([
    {
      id: 'user-1',
      parentMessageId: null,
      role: 'USER',
      mode: 'CRITICAL',
      status: 'SUCCESS',
      action: { actionId: 'key_takeaways', input: { target: 'workspace' } },
    },
    {
      id: 'assistant-1',
      parentMessageId: 'user-1',
      role: 'ASSISTANT',
      mode: 'CRITICAL',
      status: 'SENDING',
    },
  ]);
  assert.deepEqual(recovered, {
    actionId: 'key_takeaways',
    mode: 'CRITICAL',
    phase: 'GENERATING',
  });
  assert.match(getGenerationStatusLabel(recovered!), /key takeaways.*Critical mode/i);
});
