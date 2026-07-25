import React, { useState } from 'react';
import {
  Bell,
  Settings,
  Edit3,
  Check,
  X,
  Shield,
  Menu,
  Layers,
  Sparkles,
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
  const [showNotifications, setShowNotifications] = useState(false);

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
    <header className="h-16 px-4 md:px-6 bg-[#121824]/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-20 flex items-center justify-between shrink-0 select-none">
      {/* Left: Mobile Menu Trigger + Workspace Title / Rename */}
      <div className="flex items-center space-x-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800"
          title="Toggle Sources"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0">
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
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
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
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Actions & User Profile */}
      <div className="flex items-center space-x-3 shrink-0">
        {/* Verification Badge */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-[11px] text-emerald-300 font-medium">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>pgvector Scope</span>
        </div>

        {/* Notifications Popover Placeholder */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-[#121824] border border-slate-800 rounded-2xl shadow-2xl p-3.5 text-xs space-y-2 z-50 animate-fade-in">
              <div className="flex items-center justify-between text-slate-200 font-semibold border-b border-slate-800/80 pb-2">
                <span>Workspace Activity</span>
                <span className="text-[10px] text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded font-mono">
                  ACTIVE
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Knowledge workspace ready for source ingestion and vector indexing.
              </p>
            </div>
          )}
        </div>

        {/* Workspace Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          title="Workspace Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Profile Badge */}
        <div className="flex items-center space-x-2.5 pl-2 border-l border-slate-800/80">
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
