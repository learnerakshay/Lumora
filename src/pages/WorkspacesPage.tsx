import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { getWorkspaceIdentity, WorkspaceIcon } from '../components/dashboard/WorkspaceIcon';
import { CreateWorkspaceModal } from '../components/dashboard/CreateWorkspaceModal';
import { RenameWorkspaceModal } from '../components/dashboard/RenameWorkspaceModal';
import { DeleteWorkspaceModal } from '../components/dashboard/DeleteWorkspaceModal';
import {
  Plus,
  ArrowRight,
  Edit2,
  Trash2,
  FileText,
  Globe,
  AlignLeft,
  Youtube,
  Subtitles,
  Layers,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
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

type SourceType = 'PDF' | 'WEBSITE' | 'TEXT' | 'YOUTUBE' | 'VTT';
type SourceStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface WorkspaceSourceSummary {
  id: string;
  type: SourceType;
  status: SourceStatus;
}

const SOURCE_META: Record<SourceType, { label: string; icon: React.ElementType; className: string }> = {
  PDF: { label: 'PDF', icon: FileText, className: 'text-rose-300' },
  WEBSITE: { label: 'Website', icon: Globe, className: 'text-sky-300' },
  TEXT: { label: 'Text', icon: AlignLeft, className: 'text-violet-300' },
  YOUTUBE: { label: 'YouTube', icon: Youtube, className: 'text-red-300' },
  VTT: { label: 'Captions', icon: Subtitles, className: 'text-amber-300' },
};

const isSourceType = (value: unknown): value is SourceType =>
  typeof value === 'string' && value in SOURCE_META;

const isSourceStatus = (value: unknown): value is SourceStatus =>
  value === 'PENDING' || value === 'PROCESSING' || value === 'COMPLETED' || value === 'FAILED';

function uniqueSourceTypes(sources: WorkspaceSourceSummary[]): SourceType[] {
  return [...new Set(sources.map((source) => source.type))];
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
  const [sourceSummaries, setSourceSummaries] = useState<Record<string, WorkspaceSourceSummary[]>>({});

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

  const hydrateSourceSummaries = async (records: Workspace[]) => {
    const results = await Promise.allSettled(
      records.map(async (workspace) => {
        const response = await fetch(`/api/workspaces/${workspace.id}/sources`);
        if (!response.ok) return [workspace.id, [] as WorkspaceSourceSummary[]] as const;
        const payload: unknown = await response.json();
        const data =
          typeof payload === 'object' && payload !== null &&
          'success' in payload && payload.success === true &&
          'data' in payload && Array.isArray(payload.data)
            ? payload.data
            : [];
        const summaries = data.flatMap((source: unknown) => {
          if (typeof source !== 'object' || source === null) return [];
          const record = source as Record<string, unknown>;
          if (typeof record.id !== 'string' || !isSourceType(record.type) || !isSourceStatus(record.status)) return [];
          return [{ id: record.id, type: record.type, status: record.status }];
        });
        return [workspace.id, summaries] as const;
      })
    );

    const next: Record<string, WorkspaceSourceSummary[]> = {};
    results.forEach((result) => {
      if (result.status === 'fulfilled') next[result.value[0]] = result.value[1];
    });
    setSourceSummaries(next);
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
        void hydrateSourceSummaries(payload.data);
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
    setSourceSummaries((prev) => ({ ...prev, [newWs.id]: [] }));
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

  const totalWorkspaces = workspaces.length;
  const recentWorkspaces = useMemo(
    () => [...workspaces]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3),
    [workspaces]
  );
  const showContinueSection = totalWorkspaces >= 10 && !searchTerm.trim();

  const openWorkspace = (workspace: Workspace) => navigate(`/workspaces/${workspace.id}`);

  const renderWorkspaceCard = (workspace: Workspace) => {
    const identity = getWorkspaceIdentity(workspace.icon);
    const sources = sourceSummaries[workspace.id] || [];
    const sourceTypes = uniqueSourceTypes(sources);
    const processingCount = sources.filter(
      (source) => source.status === 'PENDING' || source.status === 'PROCESSING'
    ).length;

    return (
      <article
        key={workspace.id}
        style={{ '--identity-color': identity.color, '--identity-rgb': identity.rgb } as React.CSSProperties}
        className="workspace-card group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-[#111824] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#131c29] hover:shadow-[0_20px_48px_rgba(0,0,0,0.28)] focus-within:ring-2 focus-within:ring-[rgb(var(--identity-rgb)/0.24)] sm:p-[18px]"
      >
        <button
          type="button"
          aria-label={`Open ${workspace.name}`}
          onClick={() => openWorkspace(workspace)}
          className="absolute inset-0 z-0 rounded-2xl focus:outline-none"
        />
        <div className="pointer-events-none relative z-10 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--identity-rgb)/0.26)] bg-[rgb(var(--identity-rgb)/0.1)] text-[var(--identity-color)] shadow-inner shadow-black/20 transition-[background-color,border-color,box-shadow] duration-200 group-hover:border-[rgb(var(--identity-rgb)/0.5)] group-hover:bg-[rgb(var(--identity-rgb)/0.15)] group-hover:shadow-[0_0_18px_rgb(var(--identity-rgb)/0.1)]">
              <WorkspaceIcon name={workspace.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-slate-100 transition-colors group-hover:text-white">
                {workspace.name}
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">
                Updated {formatRelativeTime(workspace.updatedAt)}
              </p>
            </div>
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setRenameWorkspace(workspace);
              }}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-cyan-300"
              title="Rename / Edit Workspace"
              aria-label={`Edit ${workspace.name}`}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteWorkspace(workspace);
              }}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-950/40 hover:text-rose-300"
              title="Delete Workspace"
              aria-label={`Delete ${workspace.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none relative z-10 mt-4 flex min-h-8 items-center justify-between gap-3 border-t border-slate-800/70 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            {workspace.sourcesCount === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <FileText className="h-3.5 w-3.5 text-slate-600" />
                No sources yet
              </span>
            ) : (
              <>
                <span className="text-[11px] text-slate-500">
                  {workspace.sourcesCount} {workspace.sourcesCount === 1 ? 'source' : 'sources'}
                </span>
                {sourceTypes.length > 0 && (
                  <div className="flex items-center -space-x-1" aria-label={`Source types: ${sourceTypes.map((type) => SOURCE_META[type].label).join(', ')}`}>
                    {sourceTypes.slice(0, 4).map((type) => {
                      const meta = SOURCE_META[type];
                      const Icon = meta.icon;
                      return (
                        <span key={type} title={meta.label} className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-700/90 bg-[#0d131d]">
                          <Icon className={`h-2.5 w-2.5 ${meta.className}`} />
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {processingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-cyan-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                Processing
              </span>
            )}
          </div>

          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-300 opacity-100 transition-all duration-200 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
            Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </article>
    );
  };

  return (
    <DashboardLayout
      searchTerm={searchTerm}
      onSearchChange={loading || workspaces.length > 0 ? setSearchTerm : undefined}
      onCreateWorkspaceClick={!loading && workspaces.length > 0 ? () => setIsCreateOpen(true) : undefined}
    >
      <div className="animate-fade-in">
        {/* Toast Feedback */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 rounded-2xl border border-emerald-800 bg-emerald-950 p-4 text-xs text-emerald-200 shadow-2xl animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-6 flex items-center justify-between rounded-2xl border border-rose-800/80 bg-rose-950/60 p-4 text-xs text-rose-300">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button onClick={fetchWorkspaces} className="rounded-lg bg-rose-900 px-3 py-1 font-medium text-white transition-colors hover:bg-rose-800">Retry</button>
          </div>
        )}

        {loading && workspaces.length === 0 ? (
          <div className="space-y-7" aria-busy="true" aria-label="Loading Workspaces">
            <div className="h-24 animate-pulse rounded-2xl border border-slate-800/80 bg-[#111824]" />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="min-h-[190px] animate-pulse space-y-4 rounded-2xl border border-slate-800/80 bg-[#111824] p-5">
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
          </div>
        ) : totalWorkspaces === 0 && !searchTerm ? (
          <section className="relative flex min-h-[calc(100vh-8.5rem)] items-center justify-center overflow-hidden rounded-3xl border border-slate-800/70 bg-[#0e151f] px-5 py-14 shadow-[0_28px_80px_rgba(0,0,0,0.2)] sm:px-10 lg:min-h-[620px]">
            <div className="pointer-events-none absolute left-1/2 top-[22%] h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-400/[0.08] blur-[80px]" />
            <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

            <div className="relative mx-auto w-full max-w-3xl text-center">
              <div className="lumora-empty-icon-strong lumora-zero-enter lumora-zero-enter-1 relative mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[22px] text-cyan-300">
                <span className="absolute inset-2 rounded-2xl border border-white/[0.04]" />
                <Layers className="relative h-9 w-9" strokeWidth={1.6} />
              </div>

              <h1 className="lumora-zero-enter lumora-zero-enter-1 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                Build your first knowledge Workspace
              </h1>
              <p className="lumora-zero-enter lumora-zero-enter-1 mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400 sm:text-[15px]">
                Add PDFs, websites, notes, or videos and ask grounded questions from your own sources.
              </p>

              <div className="lumora-zero-enter lumora-zero-enter-2 relative mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-5 text-left sm:grid-cols-3 sm:gap-4 sm:text-center">
                <div className="absolute bottom-auto left-5 top-5 h-[calc(100%-2.5rem)] w-px bg-gradient-to-b from-cyan-400/45 via-slate-700/70 to-slate-800/40 sm:left-[16.66%] sm:right-[16.66%] sm:top-5 sm:h-px sm:w-auto sm:bg-gradient-to-r" />
                {[
                  ['1', 'Create Workspace', 'Set up a focused knowledge space'],
                  ['2', 'Add Sources', 'Bring in the material you trust'],
                  ['3', 'Ask with Citations', 'Get grounded, traceable answers'],
                ].map(([step, title, description], index) => (
                  <div key={step} className="relative flex items-start gap-4 sm:block">
                    <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${index === 0 ? 'border-cyan-300 bg-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.16)]' : 'border-slate-700 bg-[#101722] text-slate-500'}`}>
                      {step}
                    </span>
                    <div className="pt-0.5 sm:pt-0">
                      <p className="font-medium text-slate-200 sm:mt-3 sm:text-sm">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                    </div>
                    {index < 2 && <ChevronRight className="absolute right-[-14px] top-3 hidden h-4 w-4 text-cyan-400/30 sm:block" />}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="lumora-zero-enter lumora-zero-enter-3 mt-10 inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.16)] transition-[background-color,box-shadow] duration-200 hover:bg-cyan-200 hover:shadow-[0_16px_34px_rgba(34,211,238,0.22)]"
              >
                <Plus className="h-4 w-4" />
                Create Workspace
              </button>
            </div>
          </section>
        ) : (
          <div className="space-y-7">
            <section className="flex flex-col gap-5 border-b border-slate-800/70 pb-7 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium text-cyan-400">Welcome back, {user?.fullName?.split(' ')[0] || 'learner'}</p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Your Workspaces</h1>
                <p className="mt-2 text-sm text-slate-400">Find a Workspace or create a new one to keep learning.</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                  aria-label="Sort Workspaces"
                  className="h-9 rounded-xl border border-slate-800 bg-[#111824] px-3 text-xs font-medium text-slate-300 outline-none transition-colors focus:border-cyan-500/60"
                >
                  <option value="newest">Recently Updated</option>
                  <option value="oldest">Oldest First</option>
                  <option value="sources">Most Sources</option>
                </select>
                <button type="button" onClick={fetchWorkspaces} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-[#111824] text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-200" title="Refresh Workspaces" aria-label="Refresh Workspaces">
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-cyan-300' : ''}`} />
                </button>
              </div>
            </section>

            <div className="relative md:hidden">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search Workspaces" aria-label="Search Workspaces" className="h-10 w-full rounded-xl border border-slate-800 bg-[#111824] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none" />
            </div>

            {showContinueSection && (
              <section aria-labelledby="continue-heading" className="space-y-4">
                <div>
                  <h2 id="continue-heading" className="text-base font-semibold tracking-tight text-slate-100">Continue where you left off</h2>
                  <p className="mt-1 text-xs text-slate-500">Your most recently updated Workspaces.</p>
                </div>
                <div className="grid max-w-[1120px] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {recentWorkspaces.map(renderWorkspaceCard)}
                </div>
              </section>
            )}

            <section aria-labelledby="library-heading" className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 id="library-heading" className="text-base font-semibold tracking-tight text-slate-100">
                  {showContinueSection ? 'All Workspaces' : 'Workspace library'}
                </h2>
                <span className="rounded-full border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {filteredWorkspaces.length}
                </span>
              </div>

              {filteredWorkspaces.length === 0 ? (
                <div className="rounded-2xl border border-slate-800/80 bg-[#111824] px-6 py-14 text-center">
                  <Search className="mx-auto h-6 w-6 text-slate-600" />
                  <h3 className="mt-4 text-sm font-semibold text-slate-200">No matching Workspaces</h3>
                  <p className="mt-1.5 text-xs text-slate-500">Try another name or clear your search.</p>
                  <button type="button" onClick={() => setSearchTerm('')} className="mt-5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800">Clear search</button>
                </div>
              ) : (
                <div className="grid max-w-[1120px] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {filteredWorkspaces.map(renderWorkspaceCard)}
                </div>
              )}
            </section>
          </div>
        )}
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
