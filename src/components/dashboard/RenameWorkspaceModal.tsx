import React, { useState, useEffect } from 'react';
import { WORKSPACE_ICONS } from './WorkspaceIcon';
import { X, Edit3, Loader2 } from 'lucide-react';

interface RenameWorkspaceModalProps {
  isOpen: boolean;
  workspace: {
    id: string;
    name: string;
    description?: string | null;
    icon?: string | null;
  } | null;
  onClose: () => void;
  onUpdate: (
    id: string,
    data: { name: string; description?: string; icon?: string }
  ) => Promise<void>;
}

export function RenameWorkspaceModal({
  isOpen,
  workspace,
  onClose,
  onUpdate,
}: RenameWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('folder');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setDescription(workspace.description || '');
      setSelectedIcon(workspace.icon || 'folder');
      setError(null);
    }
  }, [workspace]);

  if (!isOpen || !workspace) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Workspace name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onUpdate(workspace.id, {
        name: trimmedName,
        description: description.trim() || undefined,
        icon: selectedIcon,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-workspace-title"
        className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-[#121824] shadow-2xl shadow-black/80 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="edit-workspace-title" className="text-base font-semibold text-white">Edit Workspace</h2>
              <p className="text-xs text-slate-400">Update its name, description, or icon</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit Workspace dialog"
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
              maxLength={60}
              required
              className="w-full px-3.5 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full px-3.5 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors resize-none"
            />
          </div>

          {/* Icon Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Workspace Icon</label>
            <div className="grid grid-cols-5 gap-2">
              {WORKSPACE_ICONS.map(({ id, label, Icon }) => {
                const isSelected = selectedIcon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedIcon(id)}
                    title={label}
                    aria-label={`${label} Workspace icon`}
                    aria-pressed={isSelected}
                    className={`flex items-center justify-center p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-sky-950/80 border-sky-500 text-sky-400 shadow-sm shadow-sky-500/20'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
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
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-md shadow-sky-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
