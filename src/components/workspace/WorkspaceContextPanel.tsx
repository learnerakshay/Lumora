import React, { useEffect, useRef } from 'react';
import { BookOpen, ExternalLink, Quote, X } from 'lucide-react';
import type { StoredCitation } from '../../lib/chat/conversation-store';
import type { SourceRecord } from '../../lib/source-store';
import type { ChatResponseMode } from '../../types';
import { SourceTypeIcon } from './SourceTypeIcon';
import { citationEvidenceKey, formatCitationTimestamp } from './workspace-interactions';

interface WorkspaceContextPanelProps {
  citations: StoredCitation[];
  responseMode?: ChatResponseMode | null;
  sources: SourceRecord[];
  onSelectCitation: (citation: StoredCitation) => void;
  onClose?: () => void;
  activeCitationId?: string | null;
}

function formatLocation(citation: StoredCitation) {
  if (citation.page) return `Page ${citation.page}`;
  if (citation.timestampStartMs != null) {
    return formatCitationTimestamp(citation.timestampStartMs);
  }
  return citation.kind === 'WEB' ? 'Webpage' : 'Source passage';
}

export function WorkspaceContextPanel({
  citations,
  responseMode,
  sources,
  onSelectCitation,
  onClose,
  activeCitationId,
}: WorkspaceContextPanelProps) {
  const evidenceRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!activeCitationId) return;
    const card = evidenceRefs.current[activeCitationId];
    if (!card) return;
    const frame = requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeCitationId, citations]);

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
          <div className="mt-3 px-3 py-5 text-center">
            <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/25 bg-cyan-400/[0.06] text-cyan-300 shadow-[0_0_18px_rgba(56,189,248,0.12),0_0_18px_rgba(167,139,250,0.12)]">
              <Quote className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <p className="mt-3 text-xs font-semibold text-slate-300">
              {responseMode === 'GENERAL'
                ? 'General knowledge response'
                : 'Context appears with grounded answers'}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              {responseMode === 'GENERAL'
                ? 'No Workspace evidence was used for this response.'
                : 'When Workspace evidence supports an answer, Lumora shows the real sources used here.'}
            </p>
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
              const evidenceKey = citationEvidenceKey(citation);
              const isActive = evidenceKey === activeCitationId;
              return (
                <button
                  key={citation.id || `${citation.sourceId}-${index}`}
                  ref={(element) => { evidenceRefs.current[evidenceKey] = element; }}
                  type="button"
                  onClick={() => onSelectCitation(citation)}
                  aria-current={isActive ? 'true' : undefined}
                  style={{ animationDelay: `${Math.min(index, 5) * 80}ms` }}
                  className={`animate-fade-in group w-full rounded-2xl border bg-[#111925] p-3.5 text-left shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition-[background-color,border-color,box-shadow] duration-200 hover:border-cyan-700/55 hover:bg-[#141d2a] hover:shadow-[0_12px_26px_rgba(0,0,0,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${isActive ? 'border-cyan-400/70 bg-cyan-950/20 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_24px_rgba(34,211,238,0.12)]' : 'border-slate-800/75'}`}
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
