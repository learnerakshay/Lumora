import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface DeleteWorkspaceModalProps {
  isOpen: boolean;
  workspace: {
    id: string;
    name: string;
  } | null;
  onClose: () => void;
  onConfirmDelete: (id: string) => Promise<void>;
}

export function DeleteWorkspaceModal({
  isOpen,
  workspace,
  onClose,
  onConfirmDelete,
}: DeleteWorkspaceModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !workspace) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirmDelete(workspace.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete workspace. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-workspace-title"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-rose-900/50 bg-[#121824] shadow-2xl shadow-rose-950/20 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-rose-950/20">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 id="delete-workspace-title" className="text-base font-semibold text-white">Delete Workspace</h2>
              <p className="text-xs text-rose-300/80">Confirm destructive action</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close delete Workspace dialog"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-300 leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold text-white font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              {workspace.name}
            </span>
            ? This action cannot be undone and will delete all associated sources, chunks, and citations.
          </p>

          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-[11px] text-slate-400 font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span>Target ID:</span>
              <span className="text-slate-200">{workspace.id}</span>
            </div>
            <div className="flex items-center justify-between text-rose-400">
              <span>Cascading Deletion:</span>
              <span>All Sources & Vectors</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950 disabled:text-rose-400 text-white font-semibold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-md shadow-rose-600/30"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Workspace</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
