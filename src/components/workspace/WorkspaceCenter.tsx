import React from 'react';
import { AlignLeft, FileText, Globe, Plus, Sparkles, Youtube } from 'lucide-react';
import type { SourceRecord, SourceType } from '../../lib/source-store';

interface WorkspaceCenterProps {
  workspace: { id: string; name: string; description?: string | null };
  sources: SourceRecord[];
  onOpenAddSource: (type?: SourceType) => void;
}

const sourceChoices = [
  { type: 'PDF' as const, label: 'PDF', detail: 'Papers and documents', icon: FileText, style: 'text-rose-400 bg-rose-950/35 border-rose-900/60' },
  { type: 'WEBSITE' as const, label: 'Website', detail: 'Articles and webpages', icon: Globe, style: 'text-sky-400 bg-sky-950/35 border-sky-900/60' },
  { type: 'TEXT' as const, label: 'Plain Text', detail: 'Notes and pasted text', icon: AlignLeft, style: 'text-violet-400 bg-violet-950/35 border-violet-900/60' },
  { type: 'YOUTUBE' as const, label: 'YouTube', detail: 'Video transcripts', icon: Youtube, style: 'text-red-400 bg-red-950/35 border-red-900/60' },
];

export function WorkspaceCenter({ workspace, onOpenAddSource }: WorkspaceCenterProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-7 sm:px-6">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-800/60 bg-sky-950/50 text-sky-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">Start learning with {workspace.name}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
            {workspace.description || 'Add something you want to understand. Once it is ready, ask questions and Lumora will answer from your sources.'}
          </p>
        </div>

        <section aria-labelledby="add-source-heading" className="mt-7 rounded-2xl border border-slate-800 bg-[#111925] p-4 shadow-xl shadow-black/15 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div><h3 id="add-source-heading" className="text-sm font-semibold text-white">Add your first source</h3><p className="mt-0.5 text-xs text-slate-500">Choose the material you want to learn from.</p></div>
            <Plus className="h-5 w-5 text-sky-400" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sourceChoices.map(({ type, label, detail, icon: Icon, style }) => (
              <button key={type} type="button" onClick={() => onOpenAddSource(type)} className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/55 p-3 text-left transition hover:border-slate-700 hover:bg-slate-900">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${style}`}><Icon className="h-4 w-4" /></span>
                <span><span className="block text-xs font-semibold text-slate-200 group-hover:text-white">{label}</span><span className="mt-0.5 block text-[10px] text-slate-500">{detail}</span></span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
