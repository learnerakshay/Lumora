import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { SettingsModal } from './SettingsModal';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onCreateWorkspaceClick?: () => void;
}

const SIDEBAR_MIN = 224;
const SIDEBAR_MAX = 336;
const SIDEBAR_DEFAULT = 256;

export function DashboardLayout({
  children,
  searchTerm = '',
  onSearchChange,
  onCreateWorkspaceClick,
}: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const resizeCleanup = useRef<(() => void) | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('lumora-sidebar-collapsed') !== 'false');
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('lumora-sidebar-width'));
    return Number.isFinite(saved) && saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : SIDEBAR_DEFAULT;
  });

  useEffect(() => () => resizeCleanup.current?.(), []);

  const handleLogout = async () => {
    await signOut();
    navigate('/sign-in');
  };

  const toggleSidebar = () => {
    setIsCollapsed((current) => {
      localStorage.setItem('lumora-sidebar-collapsed', String(!current));
      return !current;
    });
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isCollapsed) return;
    event.preventDefault();
    const onMove = (moveEvent: PointerEvent) => {
      const width = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, moveEvent.clientX));
      setSidebarWidth(width);
    };
    const onUp = (upEvent: PointerEvent) => {
      const width = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, upEvent.clientX));
      localStorage.setItem('lumora-sidebar-width', String(width));
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      resizeCleanup.current = null;
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    resizeCleanup.current = () => {
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  };

  const desktopWidth = isCollapsed ? 76 : sidebarWidth;
  const initials = user?.fullName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0f17] text-[#f0f4f8] antialiased md:flex-row">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800/80 bg-[#101621]/95 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/workspaces" className="flex items-center gap-2 rounded-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400"><Sparkles className="h-4 w-4" /></span>
          <span className="font-semibold tracking-tight text-white">Lumora</span>
        </Link>
        <div className="flex items-center gap-2">
          {onCreateWorkspaceClick && <button type="button" onClick={onCreateWorkspaceClick} aria-label="Create Workspace" className="rounded-lg bg-sky-400 p-2 text-slate-950 transition hover:bg-sky-300"><Plus className="h-4 w-4" /></button>}
          <button type="button" onClick={() => setIsMobileSidebarOpen(true)} aria-label="Open navigation" aria-expanded={isMobileSidebarOpen} className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300"><Menu className="h-5 w-5" /></button>
        </div>
      </header>

      {isMobileSidebarOpen && <button type="button" aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}

      <aside
        aria-label="Dashboard navigation"
        style={{ '--sidebar-width': `${desktopWidth}px` } as React.CSSProperties}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,288px)] flex-col border-r border-slate-800/80 bg-[#101621] shadow-2xl transition-transform duration-200 md:sticky md:w-[var(--sidebar-width)] md:translate-x-0 md:shadow-none ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
          <div className={`flex h-12 items-center ${isCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
            <Link to="/workspaces" onClick={() => setIsMobileSidebarOpen(false)} className="flex min-w-0 items-center gap-2.5 rounded-lg">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400"><Layers className="h-5 w-5" /></span>
              {!isCollapsed && <span className="min-w-0"><span className="block text-base font-semibold tracking-tight text-white">Lumora</span><span className="block truncate text-[10px] text-slate-500">Your learning, organized</span></span>}
            </Link>
            <button type="button" onClick={() => setIsMobileSidebarOpen(false)} aria-label="Close navigation" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"><X className="h-4 w-4" /></button>
          </div>

          <nav className="mt-6 space-y-1" aria-label="Workspace navigation">
            {!isCollapsed && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Workspace</p>}
            <Link to="/workspaces" title={isCollapsed ? 'Workspaces' : undefined} onClick={() => setIsMobileSidebarOpen(false)} className={`relative flex h-10 items-center rounded-xl border text-sm font-medium transition ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${location.pathname === '/workspaces' ? 'border-cyan-400/15 bg-cyan-400/[0.07] text-cyan-300 shadow-[inset_0_0_18px_rgba(34,211,238,0.025)] before:absolute before:left-[-1px] before:h-5 before:w-0.5 before:rounded-full before:bg-cyan-300 before:shadow-[0_0_10px_rgba(103,232,249,0.35)]' : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
              <LayoutDashboard className="h-4 w-4 shrink-0" /><span className={isCollapsed ? 'sr-only' : ''}>Workspaces</span>
            </Link>
            <button type="button" title={isCollapsed ? 'Settings' : undefined} onClick={() => { setIsSettingsOpen(true); setIsMobileSidebarOpen(false); }} className={`flex h-10 w-full items-center rounded-xl border border-transparent text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}>
              <Settings className="h-4 w-4 shrink-0" /><span className={isCollapsed ? 'sr-only' : ''}>Settings</span>
            </button>
          </nav>

          <div className="mt-auto pt-6">
            <div className={`border-t border-slate-800/80 pt-4 ${isCollapsed ? 'space-y-2' : 'space-y-3'}`}>
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`}>
                {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-slate-700 object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-700 text-xs font-bold text-white">{initials}</span>}
                {!isCollapsed && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white">{user?.fullName || 'Learner'}</span><span className="block truncate text-[10px] text-slate-500">{user?.email}</span></span>}
              </div>
              <button type="button" onClick={handleLogout} title={isCollapsed ? 'Sign out' : undefined} className={`flex h-9 w-full items-center rounded-xl text-xs font-medium text-slate-400 transition hover:bg-rose-950/30 hover:text-rose-300 ${isCollapsed ? 'justify-center' : 'justify-center gap-2'}`}><LogOut className="h-3.5 w-3.5" /><span className={isCollapsed ? 'sr-only' : ''}>Sign out</span></button>
            </div>
          </div>
        </div>

        <button type="button" onClick={toggleSidebar} className="hidden h-11 items-center justify-center gap-2 border-t border-slate-800/80 text-xs text-slate-400 transition hover:bg-slate-900 hover:text-white md:flex" aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse sidebar</span></>}</button>
        {!isCollapsed && <button type="button" onPointerDown={startResize} aria-label="Resize sidebar" title="Drag to resize sidebar" className="absolute inset-y-0 -right-1 hidden w-2 cursor-col-resize touch-none bg-transparent after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-sky-400/0 hover:after:bg-sky-400/60 focus-visible:after:bg-sky-400 md:block" />}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {(onSearchChange || onCreateWorkspaceClick) && (
          <header className="sticky top-0 z-30 hidden h-[72px] items-center justify-between border-b border-slate-800/70 bg-[#0d131d]/90 px-6 backdrop-blur md:flex lg:px-8">
            {onSearchChange && (
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input type="search" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search Workspaces" aria-label="Search Workspaces" className="h-10 w-full rounded-xl border border-slate-800 bg-slate-900/60 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
              </div>
            )}
            {onCreateWorkspaceClick && <button type="button" onClick={onCreateWorkspaceClick} className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-200 active:translate-y-px"><Plus className="h-4 w-4" />Create Workspace</button>}
          </header>
        )}
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSignOut={handleLogout} />
    </div>
  );
}
