import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FileText,
  Layers,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
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

      const res = await fetch('/api/workspaces');
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
  return (
    <DashboardLayout
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onCreateWorkspaceClick={!loading && workspaces.length > 0 ? () => setIsCreateOpen(true) : undefined}
    >
      <div className="space-y-7">
        {/* Toast Feedback */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-950 border border-emerald-800 text-emerald-200 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs animate-slide-up">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        )}

        {/* Compact welcome and real overview */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#111824] px-5 py-5 shadow-xl shadow-black/10 sm:px-6">
          <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-sky-400">Welcome back, {user?.fullName?.split(' ')[0] || 'learner'}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Continue learning</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-400">Open a Workspace and pick up where you left off.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:w-[290px]">
              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3"><div className="flex items-center gap-2 text-xs text-slate-400"><Folder className="h-4 w-4 text-sky-400" />Workspaces</div><p className="mt-1 text-xl font-semibold text-white">{totalWorkspaces}</p></div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3"><div className="flex items-center gap-2 text-xs text-slate-400"><FileText className="h-4 w-4 text-cyan-400" />Sources</div><p className="mt-1 text-xl font-semibold text-white">{totalSources}</p></div>
            </div>
          </div>
        </section>

        {/* Workspaces Management Header & Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight flex items-center space-x-2">
                <span>Your Workspaces</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs">
                  {filteredWorkspaces.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pick up where you left off or start a new area of study.
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-3">
              {/* Sort Selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
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
                aria-label="Refresh Workspaces"
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
              aria-label="Search Workspaces"
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div role="alert" className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-2xl text-xs text-rose-300 flex items-center justify-between">
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
            <div aria-busy="true" aria-label="Loading Workspaces" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    : 'Create your first private Workspace, add trusted sources, and begin a grounded conversation.'}
                </p>
              </div>

              {!searchTerm && (
                <div className="mx-auto grid max-w-lg grid-cols-1 gap-2 text-left sm:grid-cols-3">
                  {[
                    ['1', 'Create', 'Name your Workspace'],
                    ['2', 'Add sources', 'Upload or import knowledge'],
                    ['3', 'Ask', 'Start a grounded chat'],
                  ].map(([step, title, description]) => (
                    <div key={step} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <span className="text-[10px] font-bold text-sky-400">STEP {step}</span>
                      <p className="mt-1 text-xs font-semibold text-slate-200">{title}</p>
                      <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{description}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => searchTerm ? setSearchTerm('') : setIsCreateOpen(true)}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-xs transition-colors inline-flex items-center space-x-2 shadow-lg shadow-sky-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>{searchTerm ? 'Clear Search' : 'Create Workspace'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Workspaces Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredWorkspaces.map((workspace) => (
                <article
                  key={workspace.id}
                  className="group relative flex flex-col justify-between space-y-4 rounded-2xl border border-slate-800/90 bg-[#121824] p-5 shadow-md transition duration-200 hover:-translate-y-0.5 hover:border-sky-500/50 hover:bg-[#161f30] hover:shadow-xl hover:shadow-sky-950/20"
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
                          aria-label={`Edit ${workspace.name}`}
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
                          aria-label={`Delete ${workspace.name}`}
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
                        <span>{workspace.sourcesCount} {workspace.sourcesCount === 1 ? 'source' : 'sources'}</span>
                      </span>

                      <span className="text-slate-500">
                        Updated {formatRelativeTime(workspace.updatedAt)}
                      </span>
                    </div>

                    {/* Open Workspace Action Button */}
                    <button
                      type="button"
                      onClick={() => navigate(`/workspaces/${workspace.id}`)}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-sky-500 hover:text-slate-950 text-slate-300 border border-slate-800 hover:border-sky-400 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center space-x-2 group/btn cursor-pointer"
                    >
                      <span>Continue learning</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </article>
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
