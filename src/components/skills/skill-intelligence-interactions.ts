import type { UsageLimitDetails } from '../../lib/usage/types';

export interface UploadAttemptState {
  resumeText: string;
  selectedFile: File | null;
  submitError: string | null;
  usageLimit: UsageLimitDetails | null;
}

export function blankUploadAttempt(): UploadAttemptState {
  return { resumeText: '', selectedFile: null, submitError: null, usageLimit: null };
}

// Selecting a file starts a new attempt: it replaces any pasted text and
// discards whatever error or usage-limit notice belonged to the previous
// attempt, so a stale red error can never sit next to a freshly chosen file.
export function applyFileSelected(state: UploadAttemptState, file: File | null): UploadAttemptState {
  return { ...state, selectedFile: file, resumeText: '', submitError: null, usageLimit: null };
}

// Typing also starts a new attempt. Non-empty text clears any selected file
// (mutually exclusive inputs); the error/usage-limit notice from the last
// attempt is cleared on any edit, not just a non-empty one, since the user
// is actively changing what they're about to submit.
export function applyTextChanged(state: UploadAttemptState, value: string): UploadAttemptState {
  return {
    ...state,
    resumeText: value,
    selectedFile: value ? null : state.selectedFile,
    submitError: null,
    usageLimit: null,
  };
}

export interface SkillIntelligenceResetState {
  view: 'empty';
  profileState: null;
  loadError: null;
  reanalyzeError: null;
  upload: UploadAttemptState;
}

// The full contract for "Start over": every piece of local UI state related
// to the previous attempt or report is cleared in one step, so the empty
// screen can never show a stale file, a stale error, or a stale report.
export function buildStartOverState(): SkillIntelligenceResetState {
  return {
    view: 'empty',
    profileState: null,
    loadError: null,
    reanalyzeError: null,
    upload: blankUploadAttempt(),
  };
}
