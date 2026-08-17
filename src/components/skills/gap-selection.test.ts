import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SELECTED_GAPS,
  blankGapSelection,
  canBuildLearningPlan,
  clearGapSelection,
  isGapSelected,
  selectionLimitReached,
  toggleGapSelection,
} from './gap-selection';

test('a blank selection has no role and no selected gaps', () => {
  const state = blankGapSelection();
  assert.equal(state.roleId, null);
  assert.deepEqual(state.selectedGapIds, []);
  assert.equal(canBuildLearningPlan(state), false);
});

test('toggling a gap on a fresh selection scopes the selection to that role', () => {
  const state = toggleGapSelection(blankGapSelection(), 'frontend-react-engineer', 'gap-1');
  assert.equal(state.roleId, 'frontend-react-engineer');
  assert.deepEqual(state.selectedGapIds, ['gap-1']);
});

test('toggling the same gap again deselects it', () => {
  const selected = toggleGapSelection(blankGapSelection(), 'frontend-react-engineer', 'gap-1');
  const deselected = toggleGapSelection(selected, 'frontend-react-engineer', 'gap-1');
  assert.deepEqual(deselected.selectedGapIds, []);
});

test('selecting a gap under a different role resets the selection to that role alone', () => {
  const frontendSelection = toggleGapSelection(blankGapSelection(), 'frontend-react-engineer', 'gap-1');
  const backendSelection = toggleGapSelection(frontendSelection, 'backend-node-engineer', 'gap-2');
  assert.equal(backendSelection.roleId, 'backend-node-engineer');
  assert.deepEqual(backendSelection.selectedGapIds, ['gap-2']);
});

test('the selection cannot exceed MAX_SELECTED_GAPS for one role', () => {
  let state = blankGapSelection();
  for (let index = 0; index < MAX_SELECTED_GAPS + 3; index += 1) {
    state = toggleGapSelection(state, 'frontend-react-engineer', `gap-${index}`);
  }
  assert.equal(state.selectedGapIds.length, MAX_SELECTED_GAPS);
  assert.equal(selectionLimitReached(state), true);
});

test('deselecting below the cap frees a slot for a new gap', () => {
  let state = blankGapSelection();
  for (let index = 0; index < MAX_SELECTED_GAPS; index += 1) {
    state = toggleGapSelection(state, 'frontend-react-engineer', `gap-${index}`);
  }
  assert.equal(selectionLimitReached(state), true);
  state = toggleGapSelection(state, 'frontend-react-engineer', 'gap-0');
  assert.equal(selectionLimitReached(state), false);
  state = toggleGapSelection(state, 'frontend-react-engineer', 'gap-new');
  assert.ok(state.selectedGapIds.includes('gap-new'));
});

test('isGapSelected only reports true for the currently selected role', () => {
  const state = toggleGapSelection(blankGapSelection(), 'frontend-react-engineer', 'gap-1');
  assert.equal(isGapSelected(state, 'frontend-react-engineer', 'gap-1'), true);
  assert.equal(isGapSelected(state, 'backend-node-engineer', 'gap-1'), false);
});

test('canBuildLearningPlan requires both a role and at least one selected gap', () => {
  const roleOnly = { roleId: 'frontend-react-engineer', selectedGapIds: [] };
  assert.equal(canBuildLearningPlan(roleOnly), false);
  const withGap = toggleGapSelection(blankGapSelection(), 'frontend-react-engineer', 'gap-1');
  assert.equal(canBuildLearningPlan(withGap), true);
});

test('clearGapSelection returns to a blank state', () => {
  const state = toggleGapSelection(blankGapSelection(), 'frontend-react-engineer', 'gap-1');
  assert.deepEqual(clearGapSelection(), blankGapSelection());
  assert.notDeepEqual(state, clearGapSelection());
});
