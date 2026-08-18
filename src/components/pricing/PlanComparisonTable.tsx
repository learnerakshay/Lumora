import React from 'react';
import { Check } from 'lucide-react';
import {
  LIMIT_COMPARISON_ROWS,
  PLAN_NAMES,
  SHARED_CAPABILITY_HEADER,
  SHARED_CAPABILITY_ROWS,
  USAGE_WINDOW_LABEL,
} from '../../lib/payments/pricing-presentation';

function titleCasePlan(plan: string): string {
  return `${plan.slice(0, 1)}${plan.slice(1).toLowerCase()}`;
}

// Full comparison beneath the summary cards. Split honestly into two
// blocks: the five real PLAN_LIMITS differences, then everything that is
// identical across every plan — Lumora does not gate any capability by
// plan today, and this table says so explicitly rather than implying
// differentiation that doesn't exist.
export function PlanComparisonTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#101826]/95">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <caption className="sr-only">Plan comparison across FREE, CORE, and MAX</caption>
          <thead>
            <tr className="border-b border-slate-800/90">
              <th scope="col" className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                What changes with your plan
              </th>
              {PLAN_NAMES.map((plan) => (
                <th key={plan} scope="col" className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {titleCasePlan(plan)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LIMIT_COMPARISON_ROWS.map((row) => (
              <tr key={row.action} className="border-b border-slate-800/60 last:border-b-0">
                <th scope="row" className="px-5 py-3 text-left text-xs font-medium text-slate-300">
                  {row.label}
                  <span className="ml-1.5 text-[10px] font-normal text-slate-500">({USAGE_WINDOW_LABEL})</span>
                </th>
                {PLAN_NAMES.map((plan) => (
                  <td key={plan} className="px-5 py-3 text-center font-mono text-sm text-white">
                    {row.values[plan]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-800/90 bg-slate-950/40 px-5 py-4">
        <p className="text-xs leading-relaxed text-slate-400">{SHARED_CAPABILITY_HEADER}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <caption className="sr-only">Capabilities available on every plan</caption>
          <thead>
            <tr className="border-b border-slate-800/90">
              <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                What every plan includes
              </th>
              {PLAN_NAMES.map((plan) => (
                <th key={plan} scope="col" className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {titleCasePlan(plan)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHARED_CAPABILITY_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-slate-800/50 last:border-b-0">
                <th scope="row" className="px-5 py-2.5 text-left text-xs font-normal text-slate-300">
                  {row.label}
                </th>
                {PLAN_NAMES.map((plan) => (
                  <td key={plan} className="px-5 py-2.5 text-center">
                    <Check className="mx-auto h-3.5 w-3.5 text-emerald-400" aria-label={`Included on ${titleCasePlan(plan)}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
