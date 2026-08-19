import type { LearningStage, StageId } from '../../lib/learning/types';
import { LearningStepCard } from './LearningStepCard';

const STAGE_META: Record<StageId, { text: string; dot: string; glow: string }> = {
  now: { text: 'text-rose-300', dot: 'bg-rose-400', glow: 'shadow-[0_0_8px_rgba(244,63,94,0.65)]' },
  next: { text: 'text-amber-300', dot: 'bg-amber-400', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.65)]' },
  later: { text: 'text-cyan-300', dot: 'bg-cyan-400', glow: 'shadow-[0_0_8px_rgba(34,211,238,0.65)]' },
};

interface LearningStageListProps {
  stages: readonly LearningStage[];
}

export function LearningStageList({ stages }: LearningStageListProps) {
  return (
    <div className="relative space-y-8 border-l border-slate-800 pl-6">
      {stages.map((stage) => {
        const meta = STAGE_META[stage.id];
        return (
          <section key={stage.id} aria-label={stage.label} className="relative">
            <span aria-hidden="true" className={`absolute -left-[30px] top-1 h-3 w-3 rounded-full ${meta.dot} ${meta.glow}`} />
            <h2 className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] ${meta.text}`}>
              {stage.label}
              <span className="h-px flex-1 bg-slate-800" aria-hidden="true" />
              <span className="rounded-full bg-black/25 px-1.5 py-px text-[9px] font-bold text-slate-300">{stage.steps.length}</span>
            </h2>
            <div className="space-y-3">
              {stage.steps.map((step, index) => (
                <LearningStepCard key={step.id} step={step} index={index} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
