import { useId } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Flame, Target, type LucideIcon } from 'lucide-react';
import type { ReadinessBand, ReadinessReport } from '../../lib/learning/types';

const BAND_META: Record<ReadinessBand, { label: string; text: string; icon: LucideIcon }> = {
  READY: { label: 'Ready', text: 'text-emerald-300', icon: CheckCircle2 },
  CLOSE: { label: 'Closing in', text: 'text-cyan-300', icon: Target },
  DEVELOPING: { label: 'Developing', text: 'text-amber-300', icon: Flame },
  EARLY: { label: 'Early stage', text: 'text-slate-300', icon: AlertTriangle },
};

interface ReadinessReportCardProps {
  readiness: ReadinessReport;
}

const GAUGE_RADIUS = 40;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

export function ReadinessReportCard({ readiness }: ReadinessReportCardProps) {
  const meta = BAND_META[readiness.band];
  const Icon = meta.icon;
  const gradientId = useId();
  const percent = Math.max(0, Math.min(100, readiness.readinessPercent));
  const offset = GAUGE_CIRCUMFERENCE - (percent / 100) * GAUGE_CIRCUMFERENCE;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5 shadow-[0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${meta.text}`}>
            <Icon className="h-3.5 w-3.5" /> Career Readiness — {meta.label}
          </p>
          <h2 className="text-lg font-semibold text-white">{readiness.roleTitle}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">{readiness.summary}</p>
        </div>
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r={GAUGE_RADIUS} fill="none" stroke="rgb(30 41 59)" strokeWidth="6" />
            <motion.circle
              cx="48" cy="48" r={GAUGE_RADIUS} fill="none" stroke={`url(#${gradientId})`} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={GAUGE_CIRCUMFERENCE}
              initial={{ strokeDashoffset: GAUGE_CIRCUMFERENCE }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text font-mono text-xl font-bold text-transparent">
            {readiness.readinessPercent}%
          </span>
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
