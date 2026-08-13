import React, { useState } from 'react';
import { WORKSPACE_IDENTITIES } from './WorkspaceIcon';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description?: string; icon?: string }) => Promise<void>;
}

export function CreateWorkspaceModal({ isOpen, onClose, onCreate }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('general');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Workspace name is required.');
      return;
    }

    if (trimmedName.length > 60) {
      setError('Workspace name cannot exceed 60 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreate({
        name: trimmedName,
        description: description.trim() || undefined,
        icon: selectedIcon,
      });
      // Reset form
      setName('');
      setDescription('');
      setSelectedIcon('general');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
        className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-700/70 bg-[#111925] shadow-[0_28px_80px_rgba(0,0,0,0.55)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-800/60 bg-cyan-950/70 text-cyan-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 id="create-workspace-title" className="text-base font-semibold text-white">Create Workspace</h2>
              <p className="text-xs text-slate-400">Create a focused space for your learning</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create Workspace dialog"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div role="alert" className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Workspace Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lumora Architecture & Docs"
              maxLength={60}
              required
              autoFocus
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-sm text-white placeholder-slate-500 transition-colors focus:border-cyan-400/70 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Description <span className="text-slate-500">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what this workspace contains..."
              rows={3}
              maxLength={200}
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs text-white placeholder-slate-500 transition-colors focus:border-cyan-400/70 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            />
          </div>

          {/* Icon Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-slate-300">Workspace Identity</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WORKSPACE_IDENTITIES.map(({ id, label, Icon, color, rgb }) => {
                const isSelected = selectedIcon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedIcon(id)}
                    title={`${label} Workspace identity`}
                    aria-label={`${label} Workspace identity`}
                    aria-pressed={isSelected}
                    style={{
                      '--identity-color': color,
                      '--identity-rgb': rgb,
                    } as React.CSSProperties}
                    className={`group flex min-h-16 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-200 ${isSelected ? 'workspace-identity-option-selected' : 'workspace-identity-option'}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--identity-rgb)/0.12)] text-[var(--identity-color)] transition-colors duration-200 group-hover:bg-[rgb(var(--identity-rgb)/0.18)]">
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="text-[11px] font-semibold leading-4 text-slate-300 group-hover:text-white">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center space-x-1.5 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-200 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Workspace</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
