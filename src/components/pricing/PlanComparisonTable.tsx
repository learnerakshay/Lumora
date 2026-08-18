import React from 'react';
import {
  Brain,
  Check,
  GraduationCap,
  MessageSquare,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import {
  LIMIT_COMPARISON_ROWS,
  PLAN_NAMES,
  SHARED_CAPABILITY_HEADER,
  SHARED_CAPABILITY_ROWS,
  USAGE_WINDOW_LABEL,
  type LimitComparisonRow,
} from '../../lib/payments/pricing-presentation';

function titleCasePlan(plan: string): string {
  return `${plan.slice(0, 1)}${plan.slice(1).toLowerCase()}`;
}

const ROW_ICONS: Record<LimitComparisonRow['action'], LucideIcon> = {
  CHAT: MessageSquare,
  INGESTION: Upload,
  AI_ACTION: Sparkles,
  SKILL_INTELLIGENCE: Brain,
  LEARNING_PATH: GraduationCap,
};

// CORE is the plan every other pricing surface recommends — the
// comparison table highlights the same column so the "premium" framing
// stays consistent, not just decided independently by each component.
const HIGHLIGHTED_PLAN = 'CORE';

// Full comparison beneath the summary cards. Split honestly into two
// blocks: the five real PLAN_LIMITS differences (a genuine table, since
// the numbers actually differ per column) and everything identical across
// every plan (rendered as a compact chip grid, not a 3-column checkmark
// table repeating the same "yes" three times per row — that repetition
// carried zero comparison information and read as filler).
export function PlanComparisonTable() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#101826]/95">
        <div className="border-b border-slate-800/80 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What changes with your plan</p>
          <p className="mt-0.5 text-[11px] text-slate-500">The five real usage differences, each {USAGE_WINDOW_LABEL}.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Plan comparison across FREE, CORE, and MAX</caption>
            <thead>
              <tr className="border-b border-slate-800/90">
                <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Allowance
                </th>
                {PLAN_NAMES.map((plan) => (
                  <th
                    key={plan}
                    scope="col"
                    className={`px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide ${
                      plan === HIGHLIGHTED_PLAN ? 'text-cyan-200' : 'text-slate-400'
                    }`}
                  >
                    {titleCasePlan(plan)}
                    {plan === HIGHLIGHTED_PLAN && (
                      <span className="ml-1.5 inline-block rounded-full bg-cyan-400/15 px-1.5 py-0.5 text-[8px] font-bold tracking-normal text-cyan-300">
                        Recommended
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIMIT_COMPARISON_ROWS.map((row, index) => {
                const Icon = ROW_ICONS[row.action];
                return (
                  <tr
                    key={row.action}
                    className={`border-b border-slate-800/50 last:border-b-0 ${index % 2 === 1 ? 'bg-slate-900/25' : ''}`}
                  >
                    <th scope="row" className="px-5 py-3 text-left text-xs font-medium text-slate-300">
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        {row.label}
                      </span>
                    </th>
                    {PLAN_NAMES.map((plan) => (
                      <td
                        key={plan}
                        className={`px-5 py-3 text-center font-mono text-sm ${
                          plan === HIGHLIGHTED_PLAN
                            ? 'bg-cyan-400/[0.05] font-semibold text-cyan-100'
                            : 'text-white'
                        }`}
                      >
                        {row.values[plan]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/90 bg-[#101826]/95 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What every plan includes</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{SHARED_CAPABILITY_HEADER}</p>
        <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {SHARED_CAPABILITY_ROWS.map((row) => (
            <li key={row.label} className="flex items-start gap-2 text-xs text-slate-300">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>
                {row.label}
                <span className="sr-only"> — included on FREE, CORE, and MAX</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
