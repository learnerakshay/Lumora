import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Flame, Target, type LucideIcon } from 'lucide-react';
import type { ReadinessBand, ReadinessReport } from '../../lib/learning/types';

const BAND_META: Record<ReadinessBand, { label: string; text: string; border: string; bg: string; icon: LucideIcon }> = {
  READY: { label: 'Ready', text: 'text-emerald-300', border: 'border-emerald-500/25', bg: 'bg-emerald-500/[0.06]', icon: CheckCircle2 },
  CLOSE: { label: 'Closing in', text: 'text-cyan-300', border: 'border-cyan-400/25', bg: 'bg-cyan-400/[0.06]', icon: Target },
  DEVELOPING: { label: 'Developing', text: 'text-amber-300', border: 'border-amber-500/25', bg: 'bg-amber-500/[0.06]', icon: Flame },
  EARLY: { label: 'Early stage', text: 'text-slate-300', border: 'border-slate-700', bg: 'bg-slate-800/40', icon: AlertTriangle },
};

interface ReadinessReportCardProps {
  readiness: ReadinessReport;
}

export function ReadinessReportCard({ readiness }: ReadinessReportCardProps) {
  const meta = BAND_META[readiness.band];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 ${meta.border} ${meta.bg}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${meta.text}`}>
            <Icon className="h-3.5 w-3.5" /> Career Readiness — {meta.label}
          </p>
          <h2 className="text-lg font-semibold text-white">{readiness.roleTitle}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">{readiness.summary}</p>
        </div>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-[#0d131d]">
          <span className="font-mono text-base font-semibold text-white">{readiness.readinessPercent}%</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2.5 border-t border-white/5 pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Blocking gaps</p>
          <p className="mt-1 text-sm font-semibold text-white">{readiness.blockingGapCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Plan steps</p>
          <p className="mt-1 text-sm font-semibold text-white">{readiness.totalStepCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Strengths</p>
          <p className="mt-1 text-sm font-semibold text-white">{readiness.strengthCount}</p>
        </div>
      </div>
    </motion.div>
  );
}
