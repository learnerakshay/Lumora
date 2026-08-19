import React from 'react';

interface CitationTagProps {
  source: string;
  coordinate: string;
  excerpt: string;
  score: string;
  className?: string;
  children: React.ReactNode;
}

// Wraps an existing citation chip (markup/styling untouched, passed as
// children) with a hover/focus-triggered popover showing the verbatim
// excerpt, coordinate, and embedding match score it stands for — the same
// "prove it, don't just claim it" pattern EvidenceTrustSection already uses
// for the grounded/general demo itself.
export function CitationTag({ source, coordinate, excerpt, score, className = '', children }: CitationTagProps) {
  return (
    <span
      tabIndex={0}
      className={`citation-tag group/citation relative inline-flex cursor-default rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${className}`}
    >
      {children}
      <span
        role="tooltip"
        className="citation-popover pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 translate-y-1 rounded-xl border border-slate-800 bg-[#0d1420]/98 p-3 text-left text-[11px] font-normal leading-relaxed text-slate-300 opacity-0 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-200 group-hover/citation:opacity-100 group-hover/citation:translate-y-0 group-focus-visible/citation:opacity-100 group-focus-visible/citation:translate-y-0"
      >
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          Retrieved excerpt
        </span>
        <p>&quot;{excerpt}&quot;</p>
        <div className="mt-2 flex items-center justify-between border-t border-slate-800/70 pt-2 font-mono text-[10px] text-slate-500">
          <span>
            {source} · {coordinate}
          </span>
          <span className="text-emerald-300">{score}</span>
        </div>
      </span>
    </span>
  );
}
