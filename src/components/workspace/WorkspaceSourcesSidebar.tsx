import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Layers,
  X,
  Edit2,
  Trash2,
  Info,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { SourceRecord, SourceType } from '../../lib/source-store';
import { SourceTypeIcon } from './SourceTypeIcon';
import { SourceStatusBadge } from './SourceStatusBadge';
import { getYouTubeFailureMessage } from './youtube-source-ux';
import { sourceRefreshDisabled } from './workspace-interactions';

interface WorkspaceSourcesSidebarProps {
  workspace: {
    id: string;
    name: string;
    icon?: string | null;
    slug?: string;
  };
  sources: SourceRecord[];
  loading: boolean;
  refreshing?: boolean;
  onSelectSourceDetails: (source: SourceRecord) => void;
  onRequestDeleteSource: (source: SourceRecord) => void;
  onRefreshSources?: () => void | Promise<void>;
  onOpenAddSource?: () => void;
}

export function WorkspaceSourcesSidebar({
  workspace,
  sources,
  loading,
  refreshing = false,
  onSelectSourceDetails,
  onRequestDeleteSource,
  onRefreshSources,
  onOpenAddSource,
}: WorkspaceSourcesSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<SourceType | 'ALL'>('ALL');
  const [activeMenuSourceId, setActiveMenuSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMenuSourceId) return;
    const closeMenu = () => setActiveMenuSourceId(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuSourceId]);

  const handleRemoveSource = (e: React.MouseEvent, source: SourceRecord) => {
    e.stopPropagation();
    setActiveMenuSourceId(null);
    onRequestDeleteSource(source);
  };

  const filterTypes: { type: SourceType | 'ALL'; label: string }[] = [
    { type: 'ALL', label: 'All' },
    { type: 'PDF', label: 'PDF' },
    { type: 'WEBSITE', label: 'Web' },
    { type: 'TEXT', label: 'Text' },
    { type: 'YOUTUBE', label: 'YouTube' },
  ];

  const filterStyles: Record<Exclude<SourceType, 'VTT'> | 'ALL', string> = {
    ALL: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
    PDF: 'border-rose-700/60 bg-rose-950/40 text-rose-300',
    WEBSITE: 'border-sky-700/60 bg-sky-950/40 text-sky-300',
    TEXT: 'border-violet-700/60 bg-violet-950/40 text-violet-300',
    YOUTUBE: 'border-red-700/60 bg-red-950/40 text-red-300',
  };

  const filteredSources = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return sources.filter((source) => {
      const matchesSearch =
        source.title.toLowerCase().includes(normalizedSearch) ||
        Boolean(source.url?.toLowerCase().includes(normalizedSearch));
      const matchesFilter = selectedTypeFilter === 'ALL' || source.type === selectedTypeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [searchTerm, selectedTypeFilter, sources]);

  const sourceAccent: Record<SourceType, string> = {
    PDF: 'border-l-rose-500/70',
    WEBSITE: 'border-l-sky-500/70',
    TEXT: 'border-l-violet-500/70',
    YOUTUBE: 'border-l-red-500/70',
    VTT: 'border-l-amber-500/70',
  };

  const sourceSurface: Record<SourceType, string> = {
    PDF: 'bg-rose-950/35 border-rose-900/50',
    WEBSITE: 'bg-sky-950/35 border-sky-900/50',
    TEXT: 'bg-violet-950/35 border-violet-900/50',
    YOUTUBE: 'bg-red-950/35 border-red-900/50',
    VTT: 'bg-amber-950/35 border-amber-900/50',
  };

  return (
    <aside aria-label="Workspace sources" className="flex h-full w-full shrink-0 flex-col border-r border-slate-800/80 bg-[#0e141f] lg:w-[280px]">
      {/* Top Navigation & Workspace Header */}
      <div className="space-y-3 border-b border-slate-800/80 bg-[#101722] p-3.5">
        <Link
          to="/workspaces"
          className="inline-flex items-center space-x-2 text-xs font-medium text-slate-400 hover:text-sky-300 transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>All Workspaces</span>
        </Link>

        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="text-sm font-semibold text-white">Sources</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">{sources.length} {sources.length === 1 ? 'item' : 'items'} in this Workspace</p>
          </div>

          {onRefreshSources && (
            <button
              type="button"
              onClick={() => void onRefreshSources()}
              disabled={sourceRefreshDisabled(loading, refreshing)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-wait disabled:text-slate-600 disabled:hover:bg-transparent"
              title={refreshing ? 'Refreshing sources…' : 'Refresh sources'}
              aria-label="Refresh sources"
              aria-busy={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading || refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

      </div>

      {/* Search & Filters */}
      <div className={`space-y-2 border-b border-slate-800/80 bg-slate-900/20 p-3 ${!loading && sources.length === 0 ? 'opacity-45' : ''}`}>
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sources..."
            aria-label="Search sources"
            disabled={!loading && sources.length === 0}
            className="w-full pl-8 pr-7 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear source search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pt-1 pb-0.5">
          {filterTypes.map((ft) => {
            const isSelected = selectedTypeFilter === ft.type;
            return (
              <button
                key={ft.type}
                type="button"
                disabled={!loading && sources.length === 0}
                onClick={() => setSelectedTypeFilter(ft.type)}
                aria-pressed={isSelected}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all disabled:cursor-not-allowed ${
                  isSelected
                    ? `border ${filterStyles[ft.type as keyof typeof filterStyles]}`
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                {ft.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sources List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          /* Skeleton Loading */
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3 bg-slate-900/50 border border-slate-800/60 rounded-xl animate-pulse space-y-2"
              >
                <div className="w-2/3 h-3 bg-slate-800 rounded" />
                <div className="w-1/2 h-2.5 bg-slate-800/60 rounded" />
              </div>
            ))}
          </div>
        ) : filteredSources.length === 0 ? (
          /* Empty State */
          <div className="p-6 text-center space-y-3 bg-slate-900/30 border border-dashed border-slate-700/80 rounded-2xl my-4 animate-fade-in">
            <div className="lumora-empty-icon-muted mx-auto flex h-10 w-10 items-center justify-center rounded-2xl">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">
                {searchTerm || selectedTypeFilter !== 'ALL'
                  ? 'No matching sources'
                  : 'Your source library is empty'}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                {searchTerm || selectedTypeFilter !== 'ALL'
                  ? 'Adjust your search or choose a different source type.'
                  : 'Add a PDF, webpage, plain text, or YouTube video to start learning.'}
              </p>
            </div>
            {!searchTerm && selectedTypeFilter === 'ALL' && onOpenAddSource && (
              <button type="button" onClick={onOpenAddSource} className="mx-auto inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                <Plus className="h-3.5 w-3.5" /> Add Source
              </button>
            )}
          </div>
        ) : (
          /* Source Cards List */
          filteredSources.map((source) => {
            const youtubeFailure = source.type === 'YOUTUBE' && source.status === 'FAILED'
              ? getYouTubeFailureMessage(source.metadata)
              : null;
            return (
            <article
              key={source.id}
              className={`group relative rounded-2xl border border-l-2 bg-slate-900/55 p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/90 hover:shadow-lg hover:shadow-black/15 ${sourceAccent[source.type]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectSourceDetails(source)}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left"
                  aria-label={`View details for ${source.title}`}
                >
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${sourceSurface[source.type]}`}>
                    <SourceTypeIcon type={source.type} className="w-[18px] h-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="truncate text-xs font-semibold leading-5 text-slate-100 transition-colors group-hover:text-white"
                      title={source.title}
                    >
                      {source.title}
                    </h3>
                    <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                      {source.type === 'WEBSITE' ? 'Website' : source.type === 'TEXT' ? 'Plain text' : source.type}
                    </p>
                  </div>
                </button>

                {/* Options Menu Button */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuSourceId(activeMenuSourceId === source.id ? null : source.id);
                    }}
                    aria-label={`Actions for ${source.title}`}
                    aria-haspopup="menu"
                    aria-expanded={activeMenuSourceId === source.id}
                    className="rounded-lg p-1.5 text-slate-500 opacity-70 transition hover:bg-slate-800 hover:text-white group-hover:opacity-100"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {/* Context Dropdown Menu */}
                  {activeMenuSourceId === source.id && (
                    <div
                      role="menu"
                      onClick={(event) => event.stopPropagation()}
                      className="absolute right-0 top-8 z-30 w-48 space-y-0.5 rounded-xl border border-slate-700 bg-[#161c2b] p-1.5 text-xs shadow-2xl animate-fade-in"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuSourceId(null);
                          onSelectSourceDetails(source);
                        }}
                        className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800/80 flex items-center space-x-2"
                      >
                        <Info className="w-3.5 h-3.5 text-sky-400" />
                        <span>View Details</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuSourceId(null);
                          onSelectSourceDetails(source);
                        }}
                        className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800/80 flex items-center space-x-2"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>View and manage</span>
                      </button>

                      <div className="border-t border-slate-800 my-0.5" />

                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => handleRemoveSource(e, source)}
                        className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-950/50 flex items-center space-x-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator & Last Updated */}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800/60 pt-2.5 text-[10px]">
                <SourceStatusBadge status={source.status} stage={source.stage} metadata={source.metadata} sourceType={source.type} />
                <span className="shrink-0 text-slate-500" title={`Uploaded ${new Date(source.createdAt).toLocaleString()}`}>
                  {new Date(source.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: new Date(source.createdAt).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
                  })}
                </span>
              </div>
              {youtubeFailure && (
                <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-rose-300/80">
                  {youtubeFailure.title}
                </p>
              )}
            </article>
            );
          })
        )}
      </div>

    </aside>
  );
}
