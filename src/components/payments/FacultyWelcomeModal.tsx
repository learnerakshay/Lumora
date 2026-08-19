import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, GraduationCap, X } from 'lucide-react';
import { useAccess } from './AccessProvider';
import { postPaymentsApi } from './payments-api';

const PERKS = [
  'Full CORE/MAX feature access — grounded Workspace chat, ingestion, and Career Intelligence',
  'Highest-tier usage limits for the full 12-hour rolling window',
  'Priority visibility for evaluating and guiding hackathon builders',
];

// Mounted exactly once, in DashboardLayout — same pattern as ExpiryBanner.
// Self-contained: reads isFaculty/hasSeenFacultyWelcome off the single
// GET /access fetch AccessProvider already performs, renders nothing until
// both are true, and never polls. Dismissing (X, backdrop, or the CTA) all
// funnel through the same handler, which marks it seen server-side so it
// never re-triggers for this account until a later CHAICODE99 capture
// re-arms it (see markFacultyEntitlement in faculty-store.ts).
export function FacultyWelcomeModal() {
  const access = useAccess();
  const [dismissing, setDismissing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isOpen = access.isFaculty && !access.hasSeenFacultyWelcome;

  useEffect(() => {
    if (!isOpen) return;
    // A macrotask, not requestAnimationFrame — RAF is tied to the paint/
    // compositing cycle and can simply never fire in a backgrounded or
    // non-compositing tab (the same real bug found and fixed in
    // CheckoutDialog during Phase 3D; applying the same fix here rather
    // than reintroducing it).
    const id = setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void handleDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDismiss = async () => {
    if (dismissing) return;
    setDismissing(true);
    // Optimistic close: the modal must not stay stuck open on a network
    // hiccup. If the write fails, the next GET /access (e.g. next session)
    // still reflects the true server state and the modal would reappear —
    // acceptable for a one-time welcome, not worth blocking dismissal over.
    await postPaymentsApi('/faculty-welcome/seen', {});
    await access.refresh();
    setDismissing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={() => void handleDismiss()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faculty-welcome-title"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-cyan-400/20 bg-[#101826] shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_24px_60px_rgba(8,145,178,0.16)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 bg-gradient-to-b from-cyan-400/[0.08] to-transparent p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <GraduationCap className="h-4.5 w-4.5" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/60 bg-gradient-to-r from-cyan-300 to-sky-300 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-950 shadow-[0_6px_20px_rgba(34,211,238,0.25)]">
              Faculty Access
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => void handleDismiss()}
            aria-label="Close welcome dialog"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <h2 id="faculty-welcome-title" className="text-lg font-semibold text-white">
              Welcome to Lumora, Faculty!
            </h2>
            <p className="text-xs leading-relaxed text-slate-400">
              Thank you for guiding and evaluating the next generation of builders. Your faculty access is active
              and fully unlocked.
            </p>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent" />

          <ul className="space-y-2.5 text-xs text-slate-300">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => void handleDismiss()}
            disabled={dismissing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:shadow-cyan-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101826] active:translate-y-0 disabled:opacity-60"
          >
            Enter Workspace
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
