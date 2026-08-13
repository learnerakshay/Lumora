import React from 'react';
import { BookOpen, ExternalLink, Quote, X } from 'lucide-react';
import type { StoredCitation } from '../../lib/chat/conversation-store';
import type { SourceRecord } from '../../lib/source-store';
import { SourceTypeIcon } from './SourceTypeIcon';

interface WorkspaceContextPanelProps {
  citations: StoredCitation[];
  sources: SourceRecord[];
  onSelectCitation: (citation: StoredCitation) => void;
  onClose?: () => void;
}

function formatLocation(citation: StoredCitation) {
  if (citation.page) return `Page ${citation.page}`;
  if (citation.timestampStartMs != null) {
    const seconds = Math.floor(citation.timestampStartMs / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return citation.kind === 'WEB' ? 'Webpage' : 'Source passage';
}

export function WorkspaceContextPanel({
  citations,
  sources,
  onSelectCitation,
  onClose,
}: WorkspaceContextPanelProps) {
  return (
    <aside aria-label="Response context" className="flex h-full w-full flex-col border-l border-slate-800/80 bg-[#0e141f] xl:w-[310px]">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/70 px-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen className="h-4 w-4 text-sky-400" />
            <span>Context</span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">Sources for the latest response</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close context panel" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white xl:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {citations.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-800/80 bg-[#111925]/80 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <span className="lumora-empty-icon-strong mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-cyan-300">
              <Quote className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <p className="mt-3 text-xs font-semibold text-slate-300">Context appears with answers</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Ask a question and Lumora will show the real sources used to ground its response.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end justify-between px-1 pb-0.5">
              <div>
                <p className="text-xs font-semibold text-slate-200">Cited sources</p>
                <p className="mt-0.5 text-[10px] text-slate-500">Evidence used in the latest answer</p>
              </div>
              <span className="rounded-full border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium text-slate-500">{citations.length}</span>
            </div>
            {citations.map((citation, index) => {
              const source = sources.find((item) => item.id === citation.sourceId);
              return (
                <button
                  key={citation.id || `${citation.sourceId}-${index}`}
                  type="button"
                  onClick={() => onSelectCitation(citation)}
                  style={{ animationDelay: `${Math.min(index, 5) * 80}ms` }}
                  className="animate-fade-in group w-full rounded-2xl border border-slate-800/75 bg-[#111925] p-3.5 text-left shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition-[background-color,border-color,box-shadow] duration-200 hover:border-cyan-700/55 hover:bg-[#141d2a] hover:shadow-[0_12px_26px_rgba(0,0,0,0.14)]"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/70">
                      {source ? <SourceTypeIcon type={source.type} className="h-4 w-4" /> : citation.kind === 'WEB' ? <ExternalLink className="h-4 w-4 text-sky-400" /> : <Quote className="h-4 w-4 text-violet-400" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold leading-5 text-slate-100 group-hover:text-white">{citation.title}</span>
                      <span className="mt-0.5 inline-flex rounded-md border border-cyan-900/60 bg-cyan-950/25 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300">{formatLocation(citation)}</span>
                    </span>
                  </div>
                  {citation.snippet && <span className="mt-3 line-clamp-5 block border-l-2 border-cyan-900/50 pl-3 text-[11px] leading-[1.65] text-slate-400">{citation.snippet}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
