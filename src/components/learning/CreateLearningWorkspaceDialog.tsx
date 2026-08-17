import { AlertCircle, FolderPlus, Loader2, X } from 'lucide-react';

interface CreateLearningWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  creating: boolean;
  error: string | null;
}

export function CreateLearningWorkspaceDialog({
  isOpen,
  onClose,
  onConfirm,
  creating,
  error,
}: CreateLearningWorkspaceDialogProps) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-learning-workspace-title"
        className="w-full max-w-md rounded-t-3xl border border-slate-700/70 bg-[#111925] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.55)] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-800/60 bg-cyan-950/70 text-cyan-300">
              <FolderPlus className="h-4 w-4" />
            </span>
            <h2 id="create-learning-workspace-title" className="text-base font-semibold text-white">
              Create Learning Workspace
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          This creates a new, empty Workspace for this role. It will <strong className="text-slate-200">not</strong> automatically
          add any of the recommended resources — you choose what to add as you learn.
        </p>

        {error && (
          <p role="alert" className="mt-3 flex items-center gap-1.5 rounded-lg border border-rose-800/50 bg-rose-950/25 px-3 py-2 text-xs text-rose-200">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {creating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
              </>
            ) : (
              'Create empty Workspace'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
