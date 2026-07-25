import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Layers,
  FileText,
  Globe,
  AlignLeft,
  Youtube,
  Subtitles,
  X,
  Edit2,
  Trash2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { SourceRecord, SourceType } from '../../lib/source-store';
import { SourceTypeIcon } from './SourceTypeIcon';
import { SourceStatusBadge } from './SourceStatusBadge';
import { WorkspaceIcon } from '../dashboard/WorkspaceIcon';

interface WorkspaceSourcesSidebarProps {
  workspace: {
    id: string;
    name: string;
    icon?: string | null;
    slug?: string;
  };
  sources: SourceRecord[];
  loading: boolean;
  onOpenAddSource: (type?: SourceType) => void;
  onSelectSourceDetails: (source: SourceRecord) => void;
  onDeleteSource: (sourceId: string) => void;
  onRefreshSources?: () => void;
}

export function WorkspaceSourcesSidebar({
  workspace,
  sources,
  loading,
  onOpenAddSource,
  onSelectSourceDetails,
  onDeleteSource,
  onRefreshSources,
}: WorkspaceSourcesSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<SourceType | 'ALL'>('ALL');
  const [activeMenuSourceId, setActiveMenuSourceId] = useState<string | null>(null);

  const handleRemoveSource = async (e: React.MouseEvent, source: SourceRecord) => {
    e.stopPropagation();
    setActiveMenuSourceId(null);

    if (
      !confirm(
        `Are you sure you want to remove "${source.title}" and delete all its vector embeddings?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/sources/${source.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error?.message || 'Failed to delete source from workspace.');
      }

      onDeleteSource(source.id);
    } catch (err: any) {
      alert(err.message || 'Error deleting source.');
    }
  };

  const filterTypes: { type: SourceType | 'ALL'; label: string }[] = [
    { type: 'ALL', label: 'All' },
    { type: 'PDF', label: 'PDF' },
    { type: 'WEBSITE', label: 'Web' },
    { type: 'TEXT', label: 'Text' },
    { type: 'YOUTUBE', label: 'YouTube' },
    { type: 'VTT', label: 'VTT' },
  ];

  const filteredSources = sources.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.url && s.url.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = selectedTypeFilter === 'ALL' || s.type === selectedTypeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <aside className="w-full lg:w-80 bg-[#121824] border-r border-slate-800/80 flex flex-col h-full shrink-0 select-none">
      {/* Top Navigation & Workspace Header */}
      <div className="p-4 border-b border-slate-800/80 space-y-3 bg-slate-900/40">
        <Link
          to="/workspaces"
          className="inline-flex items-center space-x-2 text-xs font-medium text-slate-400 hover:text-sky-300 transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Workspace Title & Icon */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0 shadow-sm">
              <WorkspaceIcon name={workspace.icon || 'brain'} className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate leading-tight">
                {workspace.name}
              </h1>
              <span className="text-[10px] text-slate-400 font-mono">
                {sources.length} {sources.length === 1 ? 'Source' : 'Sources'}
              </span>
            </div>
          </div>

          {onRefreshSources && (
            <button
              type="button"
              onClick={onRefreshSources}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Refresh Sources"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Add Source CTA Button */}
        <button
          type="button"
          onClick={() => onOpenAddSource()}
          className="w-full py-2.5 px-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-md shadow-sky-500/20"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Knowledge Source</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="p-3 border-b border-slate-800/80 space-y-2 bg-slate-900/20">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sources..."
            className="w-full pl-8 pr-7 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
                onClick={() => setSelectedTypeFilter(ft.type)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
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
          <div className="p-6 text-center space-y-3 bg-slate-900/20 border border-dashed border-slate-800/80 rounded-2xl my-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">
                {searchTerm || selectedTypeFilter !== 'ALL'
                  ? 'No matching sources found'
                  : 'No Sources Ingested Yet'}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                {searchTerm || selectedTypeFilter !== 'ALL'
                  ? 'Try clearing filters or search keywords.'
                  : 'Add PDF, Web, YouTube, VTT, or Text sources to power workspace context.'}
              </p>
            </div>
            {!searchTerm && selectedTypeFilter === 'ALL' && (
              <button
                type="button"
                onClick={() => onOpenAddSource()}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-sky-950 text-sky-300 border border-sky-800/60 rounded-xl text-xs font-semibold hover:bg-sky-900 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Source</span>
              </button>
            )}
          </div>
        ) : (
          /* Source Cards List */
          filteredSources.map((source) => (
            <div
              key={source.id}
              className="group relative p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl transition-all space-y-2"
            >
              <div className="flex items-start justify-between space-x-2">
                <div
                  onClick={() => onSelectSourceDetails(source)}
                  className="flex items-start space-x-2.5 cursor-pointer min-w-0 flex-1"
                >
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    <SourceTypeIcon type={source.type} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-xs font-semibold text-slate-200 group-hover:text-sky-300 transition-colors truncate"
                      title={source.title}
                    >
                      {source.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                      {source.fileSize || source.metadata?.fileSize || source.url || source.metadata?.url || 'Document Source'}
                    </p>
                  </div>
                </div>

                {/* Options Menu Button */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuSourceId(activeMenuSourceId === source.id ? null : source.id);
                    }}
                    className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {/* Context Dropdown Menu */}
                  {activeMenuSourceId === source.id && (
                    <div
                      onMouseLeave={() => setActiveMenuSourceId(null)}
                      className="absolute right-0 top-6 w-36 bg-[#161c2b] border border-slate-800 rounded-xl shadow-2xl py-1 z-30 animate-fade-in text-xs space-y-0.5"
                    >
                      <button
                        type="button"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuSourceId(null);
                          onSelectSourceDetails(source);
                        }}
                        className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800/80 flex items-center space-x-2"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Rename</span>
                      </button>

                      <div className="border-t border-slate-800 my-0.5" />

                      <button
                        type="button"
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
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/40 text-[10px]">
                <SourceStatusBadge status={source.status} metadata={source.metadata} />
                <span className="text-slate-500 font-mono">
                  {new Date(source.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 text-[10px] text-slate-400 flex items-center justify-between font-mono">
        <span>Lumora Storage</span>
        <span className="text-sky-400">Isolated Scope</span>
      </div>
    </aside>
  );
}
