import assert from 'node:assert/strict';
import test from 'node:test';
import { RESOURCE_TOPICS } from '../resources/domain';
import { ROLE_CATALOG, getRoleDefinition } from './roles';

test('the role catalog has between 4 and 5 times the minimum useful role count', () => {
  assert.ok(ROLE_CATALOG.length >= 10, 'catalog should offer real breadth to select from');
});

test('every role id is unique', () => {
  const ids = ROLE_CATALOG.map((role) => role.roleId);
  assert.equal(new Set(ids).size, ids.length);
});

test('every requirement, archetype, and competency topic exists in the shared taxonomy', () => {
  const knownTopics = new Set<string>(RESOURCE_TOPICS);
  for (const role of ROLE_CATALOG) {
    assert.ok(role.requirements.length > 0, `${role.roleId} must define requirements`);
    for (const requirement of role.requirements) {
      assert.ok(knownTopics.has(requirement.topic), `${role.roleId} requirement topic "${requirement.topic}" is not a known Topic`);
      assert.ok(requirement.weight > 0, `${role.roleId} requirement "${requirement.topic}" must have positive weight`);
    }
    assert.ok(role.projectArchetypes.length > 0, `${role.roleId} must define at least one project archetype`);
    for (const archetype of role.projectArchetypes) {
      for (const topic of archetype.signatureTopics) {
        assert.ok(knownTopics.has(topic), `${role.roleId} archetype "${archetype.id}" signature topic "${topic}" is not a known Topic`);
      }
    }
    assert.ok(role.interviewCompetencies.length > 0, `${role.roleId} must define interview competencies`);
    for (const competency of role.interviewCompetencies) {
      assert.ok(knownTopics.has(competency.topic), `${role.roleId} interview competency topic "${competency.topic}" is not a known Topic`);
    }
  }
});

test('getRoleDefinition finds a known role and returns undefined for an unknown id', () => {
  assert.equal(getRoleDefinition('frontend-react-engineer')?.title, 'Frontend Engineer (React)');
  assert.equal(getRoleDefinition('does-not-exist'), undefined);
});
