import React, { useState } from 'react';
import {
  Settings,
  Edit3,
  Check,
  X,
  Shield,
  Menu,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { WorkspaceIcon } from '../dashboard/WorkspaceIcon';

interface WorkspaceHeaderProps {
  workspace: {
    id: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    slug?: string;
  };
  onUpdateWorkspace: (updated: { name?: string; description?: string }) => Promise<void>;
  onToggleMobileSidebar: () => void;
  onOpenSettings: () => void;
}

export function WorkspaceHeader({
  workspace,
  onUpdateWorkspace,
  onToggleMobileSidebar,
  onOpenSettings,
}: WorkspaceHeaderProps) {
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(workspace.name);
  const [descInput, setDescInput] = useState(workspace.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nameInput.trim()) return;
    try {
      setSaving(true);
      await onUpdateWorkspace({
        name: nameInput.trim(),
        description: descInput.trim() || undefined,
      });
      setIsEditing(false);
    } catch (err) {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-800/80 bg-[#121824]/90 px-3 backdrop-blur-md sm:px-4 md:px-6">
      {/* Left: Mobile Menu Trigger + Workspace Title / Rename */}
      <div className="flex items-center space-x-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800"
          title="Toggle Sources"
          aria-label="Open source library"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 min-w-0">
          <div className="hidden w-8 h-8 rounded-xl bg-sky-950/80 border border-sky-800/60 sm:flex items-center justify-center text-sky-400 shrink-0">
            <WorkspaceIcon name={workspace.icon || 'brain'} className="w-4 h-4" />
          </div>

          {isEditing ? (
            <div className="flex items-center space-x-2 min-w-0">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Workspace Title"
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-sky-500 w-40 md:w-60"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="p-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-xs font-bold transition-colors"
                aria-label="Save Workspace name"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                aria-label="Cancel renaming Workspace"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 min-w-0">
              <h1 className="text-sm md:text-base font-bold text-white truncate">{workspace.name}</h1>
              <button
                type="button"
                onClick={() => {
                  setNameInput(workspace.name);
                  setDescInput(workspace.description || '');
                  setIsEditing(true);
                }}
                className="p-1 text-slate-500 hover:text-sky-300 transition-colors"
                title="Rename Workspace"
                aria-label="Rename Workspace"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Actions & User Profile */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Verification Badge */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-[11px] text-emerald-300 font-medium">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Private Workspace</span>
        </div>

        {/* Workspace Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          title="Workspace Settings"
          aria-label="Open Workspace settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Profile Badge */}
        <div className="hidden items-center space-x-2.5 border-l border-slate-800/80 pl-2 sm:flex">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-sky-500/20 shrink-0">
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:block text-left min-w-0 max-w-[120px]">
            <p className="text-xs font-semibold text-white truncate">
              {user?.fullName || 'User'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {user?.email || 'authenticated'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
