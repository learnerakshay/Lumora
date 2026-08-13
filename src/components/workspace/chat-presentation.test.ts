import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_MODE_OPTIONS, splitCitationMarkers } from './chat-presentation';

test('AI mode menu exposes the four existing response modes with concise descriptors', () => {
  assert.deepEqual(AI_MODE_OPTIONS.map((mode) => mode.id), [
    'CONCISE',
    'DETAILED',
    'CRITICAL',
    'CREATIVE',
  ]);
  assert.ok(AI_MODE_OPTIONS.every((mode) => mode.description.length > 0));
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
