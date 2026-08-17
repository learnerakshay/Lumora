import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Briefcase,
  Check,
  CheckSquare,
  ChevronDown,
  Crown,
  Flame,
  GraduationCap,
  Loader2,
  MessagesSquare,
  Square,
  Wrench,
  Zap,
} from 'lucide-react';
import type { Gap, GapCategory, GapReport, GapSeverity, TargetRole } from '../../lib/skills/types';
import { MAX_SELECTED_GAPS, type GapSelectionState } from './gap-selection';

interface SkillGapReportProps {
  roles: TargetRole[];
  report: GapReport;
  // All selection props are optional so the Phase 1 read-only report is
  // rendered identically when a caller doesn't opt into gap selection.
  selection?: GapSelectionState;
  onToggleGap?: (roleId: string, gapId: string) => void;
  onBuildPlan?: (roleId: string) => void;
  buildingRoleId?: string | null;
}

const CATEGORY_META: Record<
  GapCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; text: string; border: string; bg: string }
> = {
  'technical-gap': { label: 'Technical skill gaps', icon: Wrench, text: 'text-amber-300', border: 'border-amber-400/20', bg: 'bg-amber-400/[0.04]' },
  'project-proof': { label: 'Project evidence gaps', icon: Briefcase, text: 'text-violet-300', border: 'border-violet-400/20', bg: 'bg-violet-400/[0.04]' },
  'interview-prep': { label: 'Interview preparation gaps', icon: MessagesSquare, text: 'text-cyan-300', border: 'border-cyan-400/20', bg: 'bg-cyan-400/[0.04]' },
};

const SEVERITY_META: Record<GapSeverity, { dot: string; text: string; border: string }> = {
  HIGH: { dot: 'bg-rose-400', text: 'text-rose-300', border: 'border-rose-500/25 bg-rose-500/[0.08]' },
  MEDIUM: { dot: 'bg-amber-400', text: 'text-amber-300', border: 'border-amber-500/25 bg-amber-500/[0.08]' },
  LOW: { dot: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-700 bg-slate-800/40' },
};

function SeverityBadge({ severity }: { severity: GapSeverity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${meta.border} ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {severity}
    </span>
  );
}

function fitScorePercent(role: TargetRole): number {
  return Math.round(role.fitScore * 100);
}

function PriorityFocus({ gaps, roles }: { gaps: Gap[]; roles: TargetRole[] }) {
  const roleTitleById = new Map(roles.map((role) => [role.roleId, role.title]));
  const highPriority = gaps.filter((gap) => gap.severity === 'HIGH').slice(0, 4);
  if (highPriority.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-4"
    >
      <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-300">
        <Flame className="h-3.5 w-3.5" /> Highest-priority gaps to close first
      </p>
      <div className="flex flex-wrap gap-2">
        {highPriority.map((gap) => (
          <span key={gap.id} className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-[#101722] px-2.5 py-1 text-[11px] text-rose-100">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
            {gap.subject}
            <span className="text-rose-400/60">· {roleTitleById.get(gap.roleId) ?? 'role'}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

export function SkillGapReport({
  roles,
  report,
  selection,
  onToggleGap,
  onBuildPlan,
  buildingRoleId,
}: SkillGapReportProps) {
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(roles[0]?.roleId ?? null);
  const selectionEnabled = Boolean(onToggleGap);

  return (
    <div>
      <PriorityFocus gaps={report.gaps} roles={roles} />
      <div className="space-y-3">
        {roles.map((role, index) => {
          const roleGaps = report.gaps.filter((gap) => gap.roleId === role.roleId);
          const isExpanded = expandedRoleId === role.roleId;
          const percent = fitScorePercent(role);
          const isTopMatch = index === 0;

          return (
            <motion.article
              key={role.roleId}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index, 5) * 0.05, ease: 'easeOut' }}
              className={`overflow-hidden rounded-2xl border bg-[#101722] transition-colors ${
                isTopMatch
                  ? 'border-cyan-400/30 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_16px_40px_rgba(8,145,178,0.1)]'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedRoleId(isExpanded ? null : role.roleId)}
                aria-expanded={isExpanded}
                className={`flex w-full items-center gap-4 text-left ${isTopMatch ? 'p-5' : 'p-4'}`}
              >
                {isTopMatch ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                    <Crown className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 font-mono text-[10px] font-semibold text-slate-500">
                    {index + 1}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isTopMatch && (
                      <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-300">
                        Best match
                      </span>
                    )}
                    <h3 className={`font-semibold text-white ${isTopMatch ? 'text-base' : 'text-sm'}`}>{role.title}</h3>
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
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <div className={`overflow-hidden rounded-full bg-slate-800/90 ${isTopMatch ? 'h-2 w-48 max-w-[42vw]' : 'h-1.5 w-32 max-w-[35vw]'}`}>
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.6, delay: Math.min(index, 5) * 0.05 + 0.1, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-300">{percent}%</span>
                    <span className="text-[11px] text-slate-500">requirement coverage</span>
                    {roleGaps.length > 0 && (
                      <span className="hidden text-[11px] text-slate-600 sm:inline">· {roleGaps.length} gap{roleGaps.length === 1 ? '' : 's'}</span>
                    )}
                  </div>
                </div>
                <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 text-slate-500">
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-slate-800/80 px-5 py-4">
                      {role.matchedRequirements.length > 0 && (
                        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-3.5">
                          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400/90"><Award className="h-3 w-3" /> Already covered / strengths</p>
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
                          <div key={category} className={`rounded-xl border p-3.5 ${meta.border} ${meta.bg}`}>
                            <p className={`mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.text}`}>
                              <Icon className="h-3.5 w-3.5" /> {meta.label}
                              <span className="rounded-full bg-black/25 px-1.5 py-px text-[9px] font-bold text-slate-200">{categoryGaps.length}</span>
                            </p>
                            <ul className="space-y-2">
                              {categoryGaps.map((gap) => {
                                const selected = selectionEnabled && selection?.roleId === role.roleId && selection.selectedGapIds.includes(gap.id);
                                const disabledByLimit =
                                  selectionEnabled &&
                                  !selected &&
                                  selection?.roleId === role.roleId &&
                                  (selection?.selectedGapIds.length ?? 0) >= MAX_SELECTED_GAPS;
                                const content = (
                                  <>
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="text-xs font-medium text-slate-100">{gap.subject}</p>
                                      <SeverityBadge severity={gap.severity} />
                                    </div>
                                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{gap.rationale}</p>
                                  </>
                                );
                                if (!selectionEnabled) {
                                  return (
                                    <li key={gap.id} className="rounded-lg border border-slate-800 bg-[#0d131d] p-3">
                                      {content}
                                    </li>
                                  );
                                }
                                return (
                                  <li key={gap.id}>
                                    <button
                                      type="button"
                                      onClick={() => onToggleGap?.(role.roleId, gap.id)}
                                      disabled={disabledByLimit}
                                      aria-pressed={selected}
                                      className={`flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                        selected
                                          ? 'border-cyan-400/40 bg-cyan-400/[0.06]'
                                          : 'border-slate-800 bg-[#0d131d] hover:border-slate-700'
                                      }`}
                                    >
                                      <span className={`mt-0.5 shrink-0 ${selected ? 'text-cyan-300' : 'text-slate-600'}`}>
                                        {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                                      </span>
                                      <div className="min-w-0 flex-1">{content}</div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}

                      {roleGaps.length === 0 && role.matchedRequirements.length === 0 && (
                        <p className="text-xs text-slate-500">No signal for this role yet.</p>
                      )}

                      {onBuildPlan && roleGaps.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.03] p-3">
                          <span className="text-[11px] text-slate-400">
                            {selection?.roleId === role.roleId && selection.selectedGapIds.length > 0
                              ? `${selection.selectedGapIds.length} gap${selection.selectedGapIds.length === 1 ? '' : 's'} selected`
                              : 'Select gaps above to build a learning plan'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onBuildPlan(role.roleId)}
                            disabled={
                              buildingRoleId === role.roleId ||
                              !(selection?.roleId === role.roleId && selection.selectedGapIds.length > 0)
                            }
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-cyan-300 px-3 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                          >
                            {buildingRoleId === role.roleId ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Building…</>
                            ) : (
                              <><GraduationCap className="h-3.5 w-3.5" /> Build learning plan</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>
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
  const tiles = [
    { label: 'Skills identified', value: String(skillCount), icon: Award },
    { label: 'Shipped-level skills', value: String(shippedCount), icon: Zap },
    { label: 'Strongest area', value: strengthLabel, icon: Check },
  ];
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {tiles.map((tile, index) => (
        <motion.div
          key={tile.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: index * 0.05 }}
          className="rounded-xl border border-slate-800 bg-[#101722] p-3.5"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"><tile.icon className="h-3 w-3" /> {tile.label}</p>
          <p className={`mt-1.5 truncate font-semibold text-white ${index === 2 ? 'text-sm' : 'text-lg'}`}>{tile.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
