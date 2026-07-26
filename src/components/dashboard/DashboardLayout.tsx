import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { SettingsModal } from './SettingsModal';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Plus,
  Search,
  Menu,
  X,
  Sparkles,
  Shield,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onCreateWorkspaceClick?: () => void;
}

export function DashboardLayout({
  children,
  searchTerm = '',
  onSearchChange,
  onCreateWorkspaceClick,
}: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isWorkspacesActive = location.pathname.startsWith('/workspaces');

  const handleLogout = async () => {
    await signOut();
    navigate('/sign-in');
  };

  const navItems = [
    {
      label: 'Workspaces Dashboard',
      icon: LayoutDashboard,
      href: '/workspaces',
      active: isWorkspacesActive,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-[#f0f4f8] flex flex-col md:flex-row antialiased selection:bg-sky-500/30 selection:text-sky-200">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#121824] border-b border-slate-800/80 sticky top-0 z-40">
        <Link to="/workspaces" className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-base tracking-tight text-white font-mono">LUMORA</span>
        </Link>
        <div className="flex items-center space-x-2">
          {onCreateWorkspaceClick && (
            <button
              type="button"
              onClick={onCreateWorkspaceClick}
              aria-label="Create Workspace"
              className="rounded-lg bg-sky-500 p-2 text-xs font-medium text-slate-950 transition hover:bg-sky-400 active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            aria-label={isMobileSidebarOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isMobileSidebarOpen}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Overlay for mobile sidebar */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar */}
      <aside
        aria-label="Dashboard navigation"
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-64 flex-col justify-between overflow-y-auto border-r border-slate-800/80 bg-[#121824] p-4 shadow-2xl shadow-black/20 transition-transform duration-300 ease-out md:sticky md:h-screen md:translate-x-0 md:shadow-none ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Logo & Header */}
          <div className="flex items-center justify-between px-2 pt-1">
            <Link to="/workspaces" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-wider text-white font-mono block leading-none">
                  LUMORA
                </span>
                <span className="text-[10px] text-sky-400/80 font-mono tracking-widest uppercase">
                  KNOWLEDGE OS
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Core Modules
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    item.active
                      ? 'bg-sky-500/10 text-sky-300 border border-sky-500/30 font-semibold shadow-sm shadow-sky-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${item.active ? 'text-sky-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.active && <ChevronRight className="w-3.5 h-3.5 text-sky-400" />}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-all text-left"
            >
              <div className="flex items-center space-x-2.5">
                <Settings className="w-4 h-4 text-slate-400" />
                <span>System Settings</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                Info
              </span>
            </button>
          </nav>

          {/* Security Badge */}
          <div className="px-3 py-2.5 bg-slate-900/80 border border-slate-800/80 rounded-xl space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px] font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>pgvector Isolation</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              All workspace vectors are strictly scoped by account boundaries.
            </p>
          </div>
        </div>

        {/* Bottom User Section & Logout */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-sky-500/20 shrink-0">
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-[10px] text-slate-400 truncate font-mono">
                {user?.email || 'authenticated'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-900/50 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Container Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-[#121824]/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30">
          {/* Search Bar */}
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search workspaces..."
              aria-label="Search Workspaces"
              className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
            />
          </div>

          {/* Action Area */}
          <div className="flex items-center space-x-3">
            {/* Create Workspace CTA Button */}
            {onCreateWorkspaceClick && (
              <button
                type="button"
                onClick={onCreateWorkspaceClick}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-md shadow-sky-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create Workspace</span>
              </button>
            )}

            {/* User Profile Badge */}
            <div className="flex items-center space-x-2 pl-3 border-l border-slate-800/80">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-sky-400">
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
