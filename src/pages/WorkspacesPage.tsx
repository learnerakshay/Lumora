import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { WorkspaceIcon } from '../components/dashboard/WorkspaceIcon';
import { CreateWorkspaceModal } from '../components/dashboard/CreateWorkspaceModal';
import { RenameWorkspaceModal } from '../components/dashboard/RenameWorkspaceModal';
import { DeleteWorkspaceModal } from '../components/dashboard/DeleteWorkspaceModal';
import {
  Folder,
  Plus,
  ArrowRight,
  Edit2,
  Trash2,
  Sparkles,
  Shield,
  FileText,
  Activity,
  Layers,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  sourcesCount: number;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export function WorkspacesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'sources'>('newest');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renameWorkspace, setRenameWorkspace] = useState<Workspace | null>(null);
  const [deleteWorkspace, setDeleteWorkspace] = useState<Workspace | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch Workspaces
  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);

      const headers: Record<string, string> = {};
      if (user?.id) {
        headers['x-lumora-user-id'] = user.id;
      }

      const res = await fetch('/api/workspaces', { headers });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        setWorkspaces(payload.data);
      } else {
        throw new Error(payload.error?.message || 'Failed to parse workspace records.');
      }
    } catch (err: any) {
      console.error('Workspaces fetch error:', err);
      setError(err.message || 'Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user?.id]);

  // Create Workspace
  const handleCreateWorkspace = async (data: {
    name: string;
    description?: string;
    icon?: string;
  }) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (user?.id) {
      headers['x-lumora-user-id'] = user.id;
    }

    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error?.message || 'Failed to create workspace');
    }

    // Immediate state update
    const newWs: Workspace = payload.data;
    setWorkspaces((prev) => [newWs, ...prev]);
    showToast(`Workspace "${newWs.name}" created successfully.`);
  };

  // Update/Rename Workspace
  const handleUpdateWorkspace = async (
    id: string,
    data: { name: string; description?: string; icon?: string }
  ) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (user?.id) {
      headers['x-lumora-user-id'] = user.id;
    }

    const res = await fetch(`/api/workspaces/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });

    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error?.message || 'Failed to update workspace');
    }

    const updatedWs: Workspace = payload.data;
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === id || w.slug === id ? updatedWs : w))
    );
    showToast(`Workspace updated to "${updatedWs.name}".`);
  };

  // Delete Workspace
  const handleDeleteWorkspace = async (id: string) => {
    const headers: Record<string, string> = {};
    if (user?.id) {
      headers['x-lumora-user-id'] = user.id;
    }

    const res = await fetch(`/api/workspaces/${id}`, {
      method: 'DELETE',
      headers,
    });

    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error?.message || 'Failed to delete workspace');
    }

    setWorkspaces((prev) => prev.filter((w) => w.id !== id && w.slug !== id));
    showToast('Workspace permanently deleted.');
  };

  // Filtered & Sorted Workspaces
  const filteredWorkspaces = useMemo(() => {
    let list = [...workspaces];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(term) ||
          (w.description && w.description.toLowerCase().includes(term)) ||
          w.slug.toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      if (sortBy === 'sources') {
        return b.sourcesCount - a.sourcesCount;
      }
      return 0;
    });

    return list;
  }, [workspaces, searchTerm, sortBy]);

  // Derived real stats from DB records
  const totalWorkspaces = workspaces.length;
  const totalSources = workspaces.reduce((sum, w) => sum + (w.sourcesCount || 0), 0);
  const lastActiveWorkspace = workspaces[0];

  return (
    <DashboardLayout
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onCreateWorkspaceClick={() => setIsCreateOpen(true)}
    >
      <div className="space-y-8">
        {/* Toast Feedback */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-950 border border-emerald-800 text-emerald-200 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs animate-slide-up">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        )}

        {/* Hero Section */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-[#121824] via-[#161e2e] to-[#0f1420] border border-slate-800 rounded-2xl shadow-xl shadow-sky-950/10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-400 text-[10px] font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  Workspace Isolation Active
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Welcome back,{' '}
                <span className="text-sky-400">
                  {user?.fullName || 'User'}
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed">
                Manage your isolated knowledge workspaces, ingest structured sources, and execute AI-powered RAG queries.
              </p>
            </div>

            {/* Quick Action Button */}
            <div className="shrink-0 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-xs transition-colors flex items-center space-x-2 shadow-lg shadow-sky-500/25 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Workspace</span>
              </button>
            </div>
          </div>

          {/* Productivity Stats Grid (Real Data Only) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
            {/* Stat 1: Workspaces */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Workspaces</span>
                <Folder className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">{totalWorkspaces}</div>
              <p className="text-[10px] text-slate-500">Active isolated environments</p>
            </div>

            {/* Stat 2: Sources */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Knowledge Sources</span>
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">{totalSources}</div>
              <p className="text-[10px] text-slate-500">Ingested documents & web pages</p>
            </div>

            {/* Stat 3: Isolation Engine */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Vector Engine</span>
                <Database className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-sm font-semibold text-emerald-400 font-mono pt-1">
                pgvector (1536d)
              </div>
              <p className="text-[10px] text-slate-500">Isolated database storage</p>
            </div>

            {/* Stat 4: Recent Activity */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Recent Activity</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xs font-medium text-slate-200 truncate pt-1">
                {lastActiveWorkspace ? lastActiveWorkspace.name : 'No recent workspace'}
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                {lastActiveWorkspace ? formatRelativeTime(lastActiveWorkspace.updatedAt) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Workspaces Management Header & Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight flex items-center space-x-2">
                <span>All Workspaces</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
                  {filteredWorkspaces.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select a workspace to manage sources, run queries, or view citations.
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-3">
              {/* Sort Selector */}
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-[#121824] border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500 font-medium"
              >
                <option value="newest">Sort by: Recently Updated</option>
                <option value="oldest">Sort by: Oldest First</option>
                <option value="sources">Sort by: Most Sources</option>
              </select>

              <button
                type="button"
                onClick={fetchWorkspaces}
                className="p-2 bg-[#121824] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs transition-colors"
                title="Refresh Workspaces"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search bar inside content area for small screens */}
          <div className="md:hidden relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search workspaces by name or description..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-2xl text-xs text-rose-300 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={fetchWorkspaces}
                className="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Skeleton State */}
          {loading && workspaces.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="p-5 bg-[#121824] border border-slate-800/80 rounded-2xl space-y-4 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-slate-800" />
                    <div className="w-16 h-4 rounded bg-slate-800" />
                  </div>
                  <div className="space-y-2">
                    <div className="w-3/4 h-5 rounded bg-slate-800" />
                    <div className="w-full h-3 rounded bg-slate-800/60" />
                  </div>
                  <div className="pt-3 border-t border-slate-800/60 flex justify-between">
                    <div className="w-20 h-4 rounded bg-slate-800" />
                    <div className="w-24 h-4 rounded bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center bg-[#121824] border border-slate-800/80 rounded-2xl space-y-4 max-w-2xl mx-auto my-6 shadow-xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400">
                <Layers className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">
                  {searchTerm ? 'No matching workspaces found' : 'No workspaces created yet'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  {searchTerm
                    ? `No workspaces matched "${searchTerm}". Try clearing your search term or create a new workspace.`
                    : 'Create your first isolated workspace to start ingesting documentation, uploading pdfs, and running AI queries.'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-xs transition-colors inline-flex items-center space-x-2 shadow-lg shadow-sky-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Workspace</span>
                </button>
              </div>
            </div>
          ) : (
            /* Workspaces Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredWorkspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="group relative p-5 bg-[#121824] hover:bg-[#161f30] border border-slate-800/90 hover:border-sky-500/50 rounded-2xl transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-sky-950/20 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header bar of Card */}
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                        <WorkspaceIcon name={workspace.icon} className="w-5 h-5" />
                      </div>

                      <div className="flex items-center space-x-1">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameWorkspace(workspace);
                          }}
                          className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Rename / Edit Workspace"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteWorkspace(workspace);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Delete Workspace"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-semibold text-white group-hover:text-sky-300 transition-colors line-clamp-1">
                        {workspace.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {workspace.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center space-x-1">
                        <FileText className="w-3 h-3 text-sky-400" />
                        <span>{workspace.sourcesCount} sources</span>
                      </span>

                      <span className="text-slate-500">
                        {formatRelativeTime(workspace.updatedAt)}
                      </span>
                    </div>

                    {/* Open Workspace Action Button */}
                    <button
                      type="button"
                      onClick={() => navigate(`/workspaces/${workspace.id}`)}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-sky-500 hover:text-slate-950 text-slate-300 border border-slate-800 hover:border-sky-400 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group/btn cursor-pointer"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateWorkspace}
      />

      <RenameWorkspaceModal
        isOpen={Boolean(renameWorkspace)}
        workspace={renameWorkspace}
        onClose={() => setRenameWorkspace(null)}
        onUpdate={handleUpdateWorkspace}
      />

      <DeleteWorkspaceModal
        isOpen={Boolean(deleteWorkspace)}
        workspace={deleteWorkspace}
        onClose={() => setDeleteWorkspace(null)}
        onConfirmDelete={handleDeleteWorkspace}
      />
    </DashboardLayout>
  );
}
