import { useState } from 'react';
import {
  AlertTriangle,
  Award,
  Briefcase,
  Check,
  ChevronDown,
  MessagesSquare,
  Wrench,
} from 'lucide-react';
import type { GapCategory, GapReport, GapSeverity, TargetRole } from '../../lib/skills/types';

interface SkillGapReportProps {
  roles: TargetRole[];
  report: GapReport;
}

const CATEGORY_META: Record<GapCategory, { label: string; icon: React.ComponentType<{ className?: string }>; accent: string }> = {
  'technical-gap': { label: 'Technical skill gaps', icon: Wrench, accent: 'text-amber-300 border-amber-400/25 bg-amber-400/[0.06]' },
  'project-proof': { label: 'Project evidence gaps', icon: Briefcase, accent: 'text-violet-300 border-violet-400/25 bg-violet-400/[0.06]' },
  'interview-prep': { label: 'Interview preparation gaps', icon: MessagesSquare, accent: 'text-cyan-300 border-cyan-400/25 bg-cyan-400/[0.06]' },
};

const SEVERITY_META: Record<GapSeverity, string> = {
  HIGH: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
  MEDIUM: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  LOW: 'text-slate-400 border-slate-600/40 bg-slate-800/40',
};

function fitScorePercent(role: TargetRole): number {
  return Math.round(role.fitScore * 100);
}

export function SkillGapReport({ roles, report }: SkillGapReportProps) {
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(roles[0]?.roleId ?? null);

  return (
    <div className="space-y-4">
      {roles.map((role) => {
        const roleGaps = report.gaps.filter((gap) => gap.roleId === role.roleId);
        const isExpanded = expandedRoleId === role.roleId;
        const percent = fitScorePercent(role);

        return (
          <article key={role.roleId} className="overflow-hidden rounded-2xl border border-slate-700/65 bg-gradient-to-br from-[#121b28] to-[#101722] shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_12px_28px_rgba(0,0,0,0.12)]">
            <button
              type="button"
              onClick={() => setExpandedRoleId(isExpanded ? null : role.roleId)}
              aria-expanded={isExpanded}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{role.title}</h3>
                  {role.belowConfidenceFloor && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> Early fit
                    </span>
                  )}
                  {roleGaps.length === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      <Check className="h-3 w-3" /> Fully covered
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 w-40 max-w-[45vw] overflow-hidden rounded-full bg-slate-800/90">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="font-mono text-xs text-slate-400">{percent}% fit</span>
                  {roleGaps.length > 0 && (
                    <span className="text-[11px] text-slate-500">{roleGaps.length} gap{roleGaps.length === 1 ? '' : 's'}</span>
                  )}
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isExpanded && (
              <div className="space-y-5 border-t border-slate-800/80 px-5 py-5">
                {role.matchedRequirements.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Already covered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.matchedRequirements.map((requirement) => (
                        <span key={requirement.topic} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-1 text-[11px] text-emerald-200">
                          <Check className="h-3 w-3" /> {requirement.label}
                          <span className="text-emerald-400/70">· {requirement.observedLevel.toLowerCase()}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(['technical-gap', 'project-proof', 'interview-prep'] as GapCategory[]).map((category) => {
                  const categoryGaps = roleGaps.filter((gap) => gap.category === category);
                  if (categoryGaps.length === 0) return null;
                  const meta = CATEGORY_META[category];
                  const Icon = meta.icon;
                  return (
                    <div key={category}>
                      <p className={`mb-2 inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${meta.accent}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </p>
                      <ul className="space-y-2">
                        {categoryGaps.map((gap) => (
                          <li key={gap.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-medium text-slate-100">{gap.subject}</p>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${SEVERITY_META[gap.severity]}`}>
                                {gap.severity}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{gap.rationale}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}

                {roleGaps.length === 0 && role.matchedRequirements.length === 0 && (
                  <p className="text-xs text-slate-500">No signal for this role yet.</p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function SkillProfileSummary({
  skillCount,
  shippedCount,
  strengthLabel,
}: {
  skillCount: number;
  shippedCount: number;
  strengthLabel: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-700/65 bg-slate-900/45 p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"><Award className="h-3 w-3" /> Skills identified</p>
        <p className="mt-2 text-xl font-semibold text-white">{skillCount}</p>
      </div>
      <div className="rounded-xl border border-slate-700/65 bg-slate-900/45 p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"><Check className="h-3 w-3" /> Shipped-level skills</p>
        <p className="mt-2 text-xl font-semibold text-white">{shippedCount}</p>
      </div>
      <div className="rounded-xl border border-slate-700/65 bg-slate-900/45 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Strongest area</p>
        <p className="mt-2 truncate text-sm font-semibold text-white">{strengthLabel}</p>
      </div>
    </div>
  );
}
