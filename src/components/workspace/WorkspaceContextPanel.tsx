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
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 px-4">
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
          <div className="mt-4 rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/30 px-4 py-7 text-center">
            <Quote className="mx-auto h-5 w-5 text-slate-600" />
            <p className="mt-3 text-xs font-semibold text-slate-300">Context appears with answers</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Ask a question and Lumora will show the real sources used to ground its response.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span>Cited sources</span>
              <span>{citations.length}</span>
            </div>
            {citations.map((citation, index) => {
              const source = sources.find((item) => item.id === citation.sourceId);
              return (
                <button
                  key={citation.id || `${citation.sourceId}-${index}`}
                  type="button"
                  onClick={() => onSelectCitation(citation)}
                  className="group w-full rounded-xl border border-slate-800 bg-slate-900/55 p-3 text-left transition hover:border-sky-700/70 hover:bg-slate-900"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/70">
                      {source ? <SourceTypeIcon type={source.type} className="h-4 w-4" /> : citation.kind === 'WEB' ? <ExternalLink className="h-4 w-4 text-sky-400" /> : <Quote className="h-4 w-4 text-violet-400" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-200 group-hover:text-white">{citation.title}</span>
                      <span className="mt-0.5 block text-[10px] font-medium text-sky-400">{formatLocation(citation)}</span>
                    </span>
                  </div>
                  {citation.snippet && <span className="mt-2.5 line-clamp-4 block border-l-2 border-slate-700 pl-2.5 text-[11px] leading-[1.55] text-slate-400">{citation.snippet}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
