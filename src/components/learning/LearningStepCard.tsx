import { motion } from 'framer-motion';
import { CheckCircle2, ListChecks, Target } from 'lucide-react';
import { LearningResourceSection } from '../workspace/LearningResourceSection';
import type { LearningStep, PriorityBand } from '../../lib/learning/types';

const BAND_BADGE: Record<PriorityBand, { label: string; text: string; border: string }> = {
  CLOSE_NOW: { label: 'Close now', text: 'text-rose-300', border: 'border-rose-500/25 bg-rose-500/[0.08]' },
  NEXT: { label: 'Next', text: 'text-amber-300', border: 'border-amber-500/25 bg-amber-500/[0.08]' },
  LATER: { label: 'Later', text: 'text-slate-400', border: 'border-slate-700 bg-slate-800/40' },
};

interface LearningStepCardProps {
  step: LearningStep;
  index: number;
}

export function LearningStepCard({ step, index }: LearningStepCardProps) {
  const badge = BAND_BADGE[step.band];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 6) * 0.04 }}
      className="rounded-2xl border border-slate-800 bg-[#101722] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{step.subject}</h3>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${badge.border} ${badge.text}`}>
          {badge.label}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.whyItMatters}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
        <Target className="h-3 w-3 shrink-0" />
        <span>{step.requiredCompetency.label}</span>
        <span className="text-slate-600">·</span>
        <span>
          {step.requiredCompetency.observedLevel === 'NONE'
            ? 'no evidence yet'
            : `currently ${step.requiredCompetency.observedLevel.toLowerCase()}`}
        </span>
        {step.requiredCompetency.targetLevel && (
          <>
            <span className="text-slate-600">→</span>
            <span className="font-medium text-cyan-300">{step.requiredCompetency.targetLevel.toLowerCase()}</span>
          </>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          <ListChecks className="h-3 w-3" /> How to close it
        </p>
        <ol className="space-y-1.5">
          {step.closurePlan.map((action, actionIndex) => (
            <li key={actionIndex} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-300">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[9px] font-semibold text-slate-400">
                {actionIndex + 1}
              </span>
              {action}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-3 rounded-xl border border-violet-500/15 bg-violet-500/[0.03] p-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-300">{step.evidenceTask.title}</p>
        <p className="text-[11px] leading-relaxed text-slate-400">{step.evidenceTask.brief}</p>
        <ul className="mt-2 space-y-1">
          {step.evidenceTask.acceptanceCriteria.map((criterion, criterionIndex) => (
            <li key={criterionIndex} className="flex items-start gap-1.5 text-[11px] text-slate-400">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-violet-400/70" /> {criterion}
            </li>
          ))}
        </ul>
      </div>

      {step.resourceStatus === 'RESOLVED' && step.resources.length > 0 ? (
        <LearningResourceSection resources={step.resources} />
      ) : (
        <p className="mt-3 text-[10px] text-slate-600">
          No specific resource matched this gap yet — search for &ldquo;{step.subject}&rdquo; directly.
        </p>
      )}
    </motion.article>
  );
}
