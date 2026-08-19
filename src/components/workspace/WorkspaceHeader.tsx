import React, { useEffect, useRef, useState } from 'react';
import {
  Settings,
  Edit3,
  Check,
  X,
  Menu,
  Loader2,
  Plus,
  PanelRight,
  MoreVertical,
} from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { getWorkspaceIdentity, WorkspaceIcon } from '../dashboard/WorkspaceIcon';
import { UsageIndicator } from '../usage/UsageIndicator';

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
  onOpenAddSource: () => void;
  onToggleContext: () => void;
  onOpenUsage: () => void;
  citationCount: number;
}

export function WorkspaceHeader({
  workspace,
  onUpdateWorkspace,
  onToggleMobileSidebar,
  onOpenSettings,
  onOpenAddSource,
  onToggleContext,
  onOpenUsage,
  citationCount,
}: WorkspaceHeaderProps) {
  const { user } = useAuth();
  const identity = getWorkspaceIdentity(workspace.icon);

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(workspace.name);
  const [descInput, setDescInput] = useState(workspace.description || '');
  const [saving, setSaving] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Mobile-only overflow menu (Response context + Settings) — closes on an
  // outside click or Escape, same lightweight pattern used by the source
  // card's own dropdown in WorkspaceSourcesSidebar.
  useEffect(() => {
    if (!moreMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreMenuOpen]);

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
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-800/80 bg-[#101722]/95 px-3 backdrop-blur-md sm:px-4 md:px-5">
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

        <div className="flex items-center gap-2.5 min-w-0">
          <div
            style={{ '--identity-color': identity.color, '--identity-rgb': identity.rgb } as React.CSSProperties}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--identity-rgb)/0.38)] bg-[rgb(var(--identity-rgb)/0.11)] text-[var(--identity-color)] shadow-[0_0_16px_rgb(var(--identity-rgb)/0.07)] sm:flex"
          >
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
              <h1 className="text-sm md:text-base font-bold tracking-wide text-white truncate">{workspace.name}</h1>
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
        <UsageIndicator compact accent="violet" onOpen={onOpenUsage} />
        <button
          type="button"
          onClick={onOpenAddSource}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-cyan-400 px-3 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-300"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Source</span>
        </button>

        <button
          type="button"
          onClick={onToggleContext}
          className="relative hidden rounded-xl border border-slate-800/80 bg-slate-900/70 p-2 text-slate-400 transition hover:border-slate-700 hover:text-white sm:block xl:hidden"
          title="Response context"
          aria-label="Open response context"
        >
          <PanelRight className="h-4 w-4" />
          {citationCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-400 px-1 text-[9px] font-bold text-slate-950">{citationCount}</span>}
        </button>

        {/* Workspace Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="hidden rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 transition-colors hover:border-slate-700 hover:text-white sm:block"
          title="Settings"
          aria-label="Open settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Mobile-only overflow menu: Response context + Settings, kept off
            the header row below sm so the title has room to breathe. */}
        <div ref={moreMenuRef} className="relative sm:hidden">
          <button
            type="button"
            onClick={() => setMoreMenuOpen((open) => !open)}
            className="relative rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
            title="More actions"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={moreMenuOpen}
          >
            <MoreVertical className="h-4 w-4" />
            {citationCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-400 px-1 text-[9px] font-bold text-slate-950">{citationCount}</span>}
          </button>
          {moreMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-30 w-52 space-y-0.5 rounded-xl border border-slate-700 bg-[#161c2b] p-1.5 text-xs shadow-2xl animate-fade-in"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onToggleContext();
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white"
              >
                <span className="flex items-center gap-2"><PanelRight className="h-3.5 w-3.5 text-sky-400" /><span>Response context</span></span>
                {citationCount > 0 && <span className="rounded-full bg-sky-400 px-1.5 text-[9px] font-bold text-slate-950">{citationCount}</span>}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenSettings();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white"
              >
                <Settings className="h-3.5 w-3.5 text-slate-400" />
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>

        {/* User Profile Badge */}
        <div className="hidden items-center space-x-2.5 border-l border-slate-800/80 pl-2 lg:flex">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-sky-500/20 shrink-0">
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:block text-left min-w-0 max-w-[120px]">
            <p className="text-xs font-semibold text-white truncate">
              {user?.fullName || 'User'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
