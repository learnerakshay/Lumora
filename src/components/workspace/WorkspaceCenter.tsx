import React, { useState } from 'react';
import {
  Search,
  UploadCloud,
  FileText,
  Globe,
  AlignLeft,
  Youtube,
  Subtitles,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { SourceType, SourceRecord } from '../../lib/source-store';
import { SourceTypeIcon } from './SourceTypeIcon';

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
  const [searchMode, setSearchMode] = useState<'AUTO' | 'DEEP' | 'ACADEMIC' | 'DOCS'>('AUTO');
  const [isDragOver, setIsDragOver] = useState(false);

  const hasSources = sources.length > 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onOpenAddSource('PDF');
  };

  const handleWebSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (webSearchQuery.trim()) {
      onOpenAddSource('WEBSITE');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-8 space-y-8 select-none">
      {/* Onboarding Banner & Center Hero */}
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Workspace Title & Onboarding Intro */}
        <div className="text-center space-y-2 pt-2">
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
        </div>

        {/* Search from Web Section (UI Only) */}
        <div className="p-5 bg-[#121824] border border-slate-800/90 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>Search & Ingest from Web</span>
            </label>

            {/* Search Mode Selector */}
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(
                [
                  { id: 'AUTO', label: 'Auto Web' },
                  { id: 'DEEP', label: 'Deep Crawl' },
                  { id: 'ACADEMIC', label: 'Academic' },
                  { id: 'DOCS', label: 'Docs' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSearchMode(m.id)}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                    searchMode === m.id
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleWebSearchSubmit} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={webSearchQuery}
                onChange={(e) => setWebSearchQuery(e.target.value)}
                placeholder="Enter search topic, web page URL, or documentation link..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shrink-0"
            >
              <span>Import URL</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </form>
        </div>

        {/* Drag and Drop Upload Zone & Source Quick Actions */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-6 md:p-8 rounded-2xl border-2 border-dashed transition-all text-center space-y-4 ${
            isDragOver
              ? 'bg-sky-950/40 border-sky-400 shadow-2xl scale-[1.01]'
              : 'bg-[#121824]/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-sky-400 flex items-center justify-center mx-auto shadow-inner">
            <UploadCloud className="w-6 h-6 animate-bounce" />
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-white">
              Drag & Drop PDF or Transcript files here
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Or choose from one of the supported source types below to begin building your isolated knowledge context.
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
                  className={`px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center space-x-2 ${item.color}`}
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
