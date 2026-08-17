export interface BuildPlanAttemptState {
  buildingRoleId: string | null;
  buildError: string | null;
}

export function blankBuildPlanAttempt(): BuildPlanAttemptState {
  return { buildingRoleId: null, buildError: null };
}

export function startBuildingPlan(roleId: string): BuildPlanAttemptState {
  return { buildingRoleId: roleId, buildError: null };
}

export function failBuildingPlan(message: string): BuildPlanAttemptState {
  return { buildingRoleId: null, buildError: message };
}

export interface WorkspaceCreationState {
  dialogOpen: boolean;
  creating: boolean;
  error: string | null;
}

export function blankWorkspaceCreationState(): WorkspaceCreationState {
  return { dialogOpen: false, creating: false, error: null };
}

export function openCreateWorkspaceDialog(state: WorkspaceCreationState): WorkspaceCreationState {
  return { ...state, dialogOpen: true, error: null };
}

// Closing must never carry a stale error into the next time the dialog is
// opened, and it must never leave `creating` stuck true if the dialog is
// dismissed mid-request.
export function closeCreateWorkspaceDialog(): WorkspaceCreationState {
  return blankWorkspaceCreationState();
}

export function startCreatingWorkspace(state: WorkspaceCreationState): WorkspaceCreationState {
  return { ...state, creating: true, error: null };
}

export function failCreatingWorkspace(state: WorkspaceCreationState, message: string): WorkspaceCreationState {
  return { ...state, creating: false, error: message };
}
