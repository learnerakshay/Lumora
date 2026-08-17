import type { LearningStage, StageId } from '../../lib/learning/types';
import { LearningStepCard } from './LearningStepCard';

const STAGE_META: Record<StageId, { text: string }> = {
  now: { text: 'text-rose-300' },
  next: { text: 'text-amber-300' },
  later: { text: 'text-slate-400' },
};

interface LearningStageListProps {
  stages: readonly LearningStage[];
}

export function LearningStageList({ stages }: LearningStageListProps) {
  return (
    <div className="space-y-6">
      {stages.map((stage) => {
        const meta = STAGE_META[stage.id];
        return (
          <section key={stage.id} aria-label={stage.label}>
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
