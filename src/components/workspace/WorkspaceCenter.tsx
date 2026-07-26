import React, { useState } from 'react';
import {
  LibraryBig,
  FileText,
  Globe,
  AlignLeft,
  Youtube,
  Subtitles,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { SourceType, SourceRecord } from '../../lib/source-store';

interface WorkspaceCenterProps {
  workspace: {
    id: string;
    name: string;
    description?: string | null;
  };
  sources: SourceRecord[];
  onOpenAddSource: (type?: SourceType) => void;
}

export function WorkspaceCenter({
  workspace,
  sources,
  onOpenAddSource,
}: WorkspaceCenterProps) {
  const [webSearchQuery, setWebSearchQuery] = useState('');

  const handleWebSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (webSearchQuery.trim()) {
      onOpenAddSource('WEBSITE');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 md:p-8">
      {/* Onboarding Banner & Center Hero */}
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Workspace Title & Onboarding Intro */}
        <div className="text-center space-y-2 pt-1 md:pt-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Lumora Knowledge Workspace</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {workspace.name}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
            {workspace.description ||
              'Build your isolated AI Knowledge Operating System by adding PDF papers, web links, YouTube videos, VTT transcripts, or text notes.'}
          </p>
          <p className="text-[11px] font-medium text-slate-500">
            {sources.length === 0
              ? 'Start by adding your first source below.'
              : `${sources.length} ${sources.length === 1 ? 'source is' : 'sources are'} ready in this Workspace.`}
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-800/90 bg-[#121824] p-4 shadow-xl shadow-black/10 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>Import a web source</span>
            </label>
            <span className="hidden text-[10px] text-slate-500 sm:inline">HTTPS webpages supported</span>
          </div>

          <form onSubmit={handleWebSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={webSearchQuery}
                onChange={(e) => setWebSearchQuery(e.target.value)}
                aria-label="Website URL"
                placeholder="https://example.com/article"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-sky-400 active:scale-[0.98]"
            >
              <span>Import URL</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </form>
        </div>

        <div className="space-y-4 rounded-2xl border border-dashed border-slate-700/90 bg-[#121824]/60 p-5 text-center transition-colors hover:border-slate-600 sm:p-6 md:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-sky-400 shadow-inner">
            <LibraryBig className="w-6 h-6" />
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-white">
              Add knowledge to this Workspace
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Choose a supported source type. Uploads and processing continue through the existing secure ingestion flow.
            </p>
          </div>

          {/* Quick Action Buttons for 5 Source Types */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {(
              [
                { type: 'PDF', label: 'PDF Document', icon: FileText, color: 'text-rose-400 hover:border-rose-800' },
                { type: 'WEBSITE', label: 'Website / Webpage', icon: Globe, color: 'text-sky-400 hover:border-sky-800' },
                { type: 'TEXT', label: 'Plain Text', icon: AlignLeft, color: 'text-emerald-400 hover:border-emerald-800' },
                { type: 'YOUTUBE', label: 'YouTube Video', icon: Youtube, color: 'text-red-400 hover:border-red-800' },
                { type: 'VTT', label: 'VTT Captions', icon: Subtitles, color: 'text-amber-400 hover:border-amber-800' },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => onOpenAddSource(item.type)}
                  className={`flex min-h-10 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:text-white active:translate-y-0 ${item.color}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>+ {item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
