import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Loader2, MessageSquare, Sparkles, Upload, X } from 'lucide-react';
import { useUsage } from './UsageProvider';
import { formatRecoveryLabel } from './UsageLimitNotice';
import type { MeteredUsageAction } from '../../lib/usage/config';

const ACTIONS: Array<{
  type: MeteredUsageAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { type: 'CHAT', label: 'Chat', icon: MessageSquare },
  { type: 'INGESTION', label: 'Ingestion', icon: Upload },
  { type: 'AI_ACTION', label: 'AI Actions', icon: Sparkles },
];

function titleCase(value: string): string {
  return `${value.slice(0, 1)}${value.slice(1).toLowerCase()}`;
}

export function WorkspaceUsageDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { summary, loading, error, refresh } = useUsage();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const nextRecovery = summary
    ? ACTIONS.map(({ type }) => summary.perAction[type].nextAvailableAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0] || null
    : null;

  return (
    <div className="fixed inset-0 z-[75] flex justify-end" aria-hidden={false}>
      <button
        type="button"
        aria-label="Close usage drawer"
        className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-usage-title"
        className="relative flex h-full w-full max-w-[500px] flex-col border-l border-cyan-400/15 bg-[#101722] shadow-[-18px_0_50px_rgba(0,0,0,0.38)] animate-fade-in sm:w-[460px]"
      >
        <header className="flex items-start justify-between border-b border-slate-800/80 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.08)]"><Gauge className="h-4 w-4" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300">Rolling capacity</p>
              <h2 id="workspace-usage-title" className="mt-0.5 text-base font-semibold text-white">Workspace usage</h2>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close usage drawer" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {loading && !summary && <div className="flex min-h-40 items-center justify-center text-sm text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading usage…</div>}
          {error && !summary && <div role="alert" className="rounded-xl border border-rose-800/60 bg-rose-950/25 p-3 text-xs text-rose-200">{error}<button type="button" onClick={() => void refresh()} className="mt-2 block font-semibold text-cyan-300 hover:text-cyan-100">Try again</button></div>}
          {summary && <>
            <section className="rounded-2xl border border-cyan-400/18 bg-gradient-to-br from-cyan-400/[0.08] to-transparent p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Current plan</p>
              <div className="mt-1 flex items-end justify-between gap-3"><p className="text-2xl font-semibold text-cyan-100">{titleCase(summary.plan)}</p><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-cyan-300">Active</span></div>
            </section>
            <section aria-label="Capacity by action" className="space-y-2.5">
              {ACTIONS.map(({ type, label, icon: Icon }) => {
                const action = summary.perAction[type];
                const percent = Math.min(100, Math.round((action.used / action.limit) * 100));
                return <article key={type} className="rounded-xl border border-slate-800 bg-slate-900/55 p-3.5">
                  <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-200"><Icon className="h-3.5 w-3.5 text-cyan-300" />{label}</div><span className="font-mono text-sm text-white">{action.used} / {action.limit}</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500" style={{ width: `${percent}%` }} /></div>
                  <p className="mt-2 text-[10px] text-slate-500">{action.remaining} remaining</p>
                </article>;
              })}
            </section>
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Next recovery</p>
              <p className="mt-1 text-sm font-medium text-slate-200">{formatRecoveryLabel(nextRecovery)}</p>
              {nextRecovery && <p className="mt-1 text-[10px] text-slate-500">{new Date(nextRecovery).toLocaleString()}</p>}
            </section>
          </>}
        </div>
        <footer className="border-t border-slate-800/80 p-5"><Link to="/usage" onClick={onClose} className="flex w-full items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-2.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/45 hover:bg-cyan-400/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">View full usage details</Link></footer>
      </aside>
    </div>
  );
}
