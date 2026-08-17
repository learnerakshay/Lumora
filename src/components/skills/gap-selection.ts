export interface GapSelectionState {
  roleId: string | null;
  selectedGapIds: readonly string[];
}

// Mirrors the safety cap in path-builder.ts (MAX_PLAN_STEPS) so the UI never
// lets a user select more gaps than the plan builder would ever act on.
export const MAX_SELECTED_GAPS = 6;

export function blankGapSelection(): GapSelectionState {
  return { roleId: null, selectedGapIds: [] };
}

// A plan is always built for exactly one role. Selecting a gap under a
// different role starts a fresh selection scoped to that role instead of
// mixing gaps across roles.
export function toggleGapSelection(
  state: GapSelectionState,
  roleId: string,
  gapId: string,
): GapSelectionState {
  if (state.roleId !== roleId) {
    return { roleId, selectedGapIds: [gapId] };
  }
  if (state.selectedGapIds.includes(gapId)) {
    return { ...state, selectedGapIds: state.selectedGapIds.filter((id) => id !== gapId) };
  }
  if (state.selectedGapIds.length >= MAX_SELECTED_GAPS) return state;
  return { ...state, selectedGapIds: [...state.selectedGapIds, gapId] };
}

export function clearGapSelection(): GapSelectionState {
  return blankGapSelection();
}

export function isGapSelected(state: GapSelectionState, roleId: string, gapId: string): boolean {
  return state.roleId === roleId && state.selectedGapIds.includes(gapId);
}

export function selectionLimitReached(state: GapSelectionState): boolean {
  return state.selectedGapIds.length >= MAX_SELECTED_GAPS;
}

export function canBuildLearningPlan(state: GapSelectionState): boolean {
  return Boolean(state.roleId) && state.selectedGapIds.length > 0;
}
