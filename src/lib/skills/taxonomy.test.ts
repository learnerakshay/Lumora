import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySkillTopic } from './taxonomy';

test('classifySkillTopic maps common resume labels onto the shared Topic vocabulary', () => {
  assert.equal(classifySkillTopic('React.js'), 'react');
  assert.equal(classifySkillTopic('  Node  '), 'nodejs');
  assert.equal(classifySkillTopic('PostgreSQL'), 'postgresql');
  assert.equal(classifySkillTopic('TypeScript'), 'typescript');
  assert.equal(classifySkillTopic('Kubernetes'), 'kubernetes');
});

test('classifySkillTopic returns null for labels with no curated mapping instead of guessing', () => {
  assert.equal(classifySkillTopic('Photoshop'), null);
  assert.equal(classifySkillTopic('Microsoft Excel'), null);
  assert.equal(classifySkillTopic(''), null);
});
