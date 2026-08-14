import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import type { SourceRecord } from '../../lib/source-store';
import { releaseSubmission, tryBeginSubmission } from './workspace-interactions';

interface DeleteSourceModalProps {
  source: SourceRecord | null;
  onClose: () => void;
  onConfirmDelete: (source: SourceRecord) => Promise<void>;
}

export function DeleteSourceModal({
  source,
  onClose,
  onConfirmDelete,
}: DeleteSourceModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!source) return;
    setError(null);
    releaseSubmission(submittingRef);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => cancelButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [source?.id]);

  if (!source) return null;

  const handleDelete = async () => {
    if (!tryBeginSubmission(submittingRef)) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirmDelete(source);
      onClose();
    } catch (deleteError) {
      releaseSubmission(submittingRef);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Lumora could not delete this source. Please try again.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-source-title"
        aria-describedby="delete-source-description"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-rose-900/50 bg-[#121824] shadow-2xl shadow-rose-950/20 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-rose-950/20 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-800/60 bg-rose-950/80 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h2 id="delete-source-title" className="text-base font-semibold text-white">Delete Source</h2>
              <p className="text-xs text-rose-300/80">This action cannot be undone</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close delete source dialog"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-800/60 bg-rose-950/50 p-3 text-xs text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <p id="delete-source-description" className="text-xs leading-relaxed text-slate-300">
            Delete <span className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono font-semibold text-white">{source.title}</span>? Its uploaded content, indexed passages, and active Context evidence will be removed. Existing chat messages will remain.
          </p>
          <div className="flex items-center justify-end gap-3 border-t border-slate-800/80 pt-3">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-rose-600/25 transition-colors hover:bg-rose-500 disabled:cursor-wait disabled:bg-rose-950 disabled:text-rose-300"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span>{isDeleting ? 'Deleting…' : 'Delete Source'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
