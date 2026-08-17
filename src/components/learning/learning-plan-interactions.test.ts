import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blankBuildPlanAttempt,
  blankWorkspaceCreationState,
  closeCreateWorkspaceDialog,
  failBuildingPlan,
  failCreatingWorkspace,
  openCreateWorkspaceDialog,
  startBuildingPlan,
  startCreatingWorkspace,
} from './learning-plan-interactions';

test('a blank build attempt has no role building and no error', () => {
  assert.deepEqual(blankBuildPlanAttempt(), { buildingRoleId: null, buildError: null });
});

test('starting a build clears any previous error', () => {
  const failed = failBuildingPlan('boom');
  const started = startBuildingPlan('frontend-react-engineer');
  assert.equal(started.buildingRoleId, 'frontend-react-engineer');
  assert.equal(started.buildError, null);
  void failed;
});

test('a failed build clears the building role so the button re-enables', () => {
  const failed = failBuildingPlan('Could not build a plan.');
  assert.equal(failed.buildingRoleId, null);
  assert.equal(failed.buildError, 'Could not build a plan.');
});

test('opening the workspace dialog clears any stale error from a previous attempt', () => {
  const withError = failCreatingWorkspace(blankWorkspaceCreationState(), 'network error');
  const reopened = openCreateWorkspaceDialog(withError);
  assert.equal(reopened.dialogOpen, true);
  assert.equal(reopened.error, null);
});

test('closing the dialog resets creating and error state entirely, even mid-request', () => {
  const midRequest = startCreatingWorkspace(openCreateWorkspaceDialog(blankWorkspaceCreationState()));
  assert.equal(midRequest.creating, true);
  const closed = closeCreateWorkspaceDialog();
  assert.deepEqual(closed, blankWorkspaceCreationState());
});

test('a failed workspace creation surfaces the error and clears the creating flag', () => {
  const midRequest = startCreatingWorkspace(openCreateWorkspaceDialog(blankWorkspaceCreationState()));
  const failed = failCreatingWorkspace(midRequest, 'Failed to create Learning Workspace');
  assert.equal(failed.creating, false);
  assert.equal(failed.error, 'Failed to create Learning Workspace');
  assert.equal(failed.dialogOpen, true);
});
