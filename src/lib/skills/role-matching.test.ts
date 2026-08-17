import assert from 'node:assert/strict';
import test from 'node:test';
import { ROLE_CATALOG } from './roles';
import { selectTargetRoles } from './role-matching';
import type { NormalizedSkill } from './types';

test('with zero evidence, selection is fully deterministic: fixed catalog order, respecting the family cap', () => {
  const selected = selectTargetRoles([]);
  assert.deepEqual(
    selected.map((role) => role.roleId),
    ['frontend-react-engineer', 'backend-node-engineer', 'fullstack-engineer', 'backend-golang-engineer', 'backend-python-engineer'],
  );
  for (const role of selected) {
    assert.equal(role.fitScore, 0);
    assert.equal(role.belowConfidenceFloor, true);
  }
});

test('a role fully matched at the required or higher evidence level has fitScore 1 and no unmet requirements', () => {
  const frontendRole = ROLE_CATALOG.find((role) => role.roleId === 'frontend-react-engineer')!;
  const skills: NormalizedSkill[] = frontendRole.requirements.map((requirement) => ({
    skillId: `topic:${requirement.topic}`,
    label: requirement.label,
    topic: requirement.topic,
    evidenceLevel: 'SHIPPED',
    evidenceRefs: [],
  }));
  const [selected] = selectTargetRoles(skills).filter((role) => role.roleId === 'frontend-react-engineer');
  assert.equal(selected.fitScore, 1);
  assert.equal(selected.unmetRequirements.length, 0);
  assert.equal(selected.belowConfidenceFloor, false);
  assert.equal(selected.matchedRequirements.length, frontendRole.requirements.length);
});

test('selection always returns between 4 and 5 roles with no family exceeding the cap of 3, across varied evidence profiles', () => {
  const fixtures: NormalizedSkill[][] = [
    [],
    [{ skillId: 'topic:python', label: 'Python', topic: 'python', evidenceLevel: 'SHIPPED', evidenceRefs: [] }],
    [
      { skillId: 'topic:golang', label: 'Go', topic: 'golang', evidenceLevel: 'SHIPPED', evidenceRefs: [] },
      { skillId: 'topic:rust', label: 'Rust', topic: 'rust', evidenceLevel: 'SHIPPED', evidenceRefs: [] },
      { skillId: 'topic:cpp', label: 'C++', topic: 'cpp', evidenceLevel: 'SHIPPED', evidenceRefs: [] },
    ],
  ];
  for (const skills of fixtures) {
    const selected = selectTargetRoles(skills);
    assert.ok(selected.length >= 4 && selected.length <= 5, `expected 4-5 roles, got ${selected.length}`);
    assert.equal(new Set(selected.map((role) => role.roleId)).size, selected.length);
    const familyCounts = new Map<string, number>();
    for (const role of selected) {
      familyCounts.set(role.family, (familyCounts.get(role.family) ?? 0) + 1);
    }
    for (const count of familyCounts.values()) {
      assert.ok(count <= 3, 'no family should exceed the cap of 3');
    }
  }
});

test('a partially met requirement below its minimum evidence level counts as unmet, not matched', () => {
  const skills: NormalizedSkill[] = [
    { skillId: 'topic:react', label: 'React', topic: 'react', evidenceLevel: 'MENTIONED', evidenceRefs: [] },
  ];
  const [role] = selectTargetRoles(skills).filter((candidate) => candidate.roleId === 'frontend-react-engineer');
  const reactRequirement = role.unmetRequirements.find((requirement) => requirement.topic === 'react');
  assert.equal(reactRequirement?.requiredLevel, 'SHIPPED');
  assert.equal(reactRequirement?.observedLevel, 'MENTIONED');
});
