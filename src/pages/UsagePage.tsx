import React from 'react';
import { Gauge, Loader2, MessageSquare, Sparkles, Upload } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { formatRecoveryTime } from '../components/usage/UsageLimitNotice';
import { useUsage } from '../components/usage/UsageProvider';
import type { MeteredUsageAction, PlanName } from '../lib/usage/config';

const ACTIONS: Array<{
  type: MeteredUsageAction;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { type: 'CHAT', label: 'Grounded chat', description: 'Completed AI answers', icon: MessageSquare },
  { type: 'INGESTION', label: 'Source ingestion', description: 'Sources processed and indexed', icon: Upload },
  { type: 'AI_ACTION', label: 'AI Actions', description: 'Completed action workflows', icon: Sparkles },
];

const PLANS: PlanName[] = ['FREE', 'CORE', 'MAX'];

function titleCasePlan(plan: PlanName): string {
  return `${plan.slice(0, 1)}${plan.slice(1).toLowerCase()}`;
}

export function UsagePage() {
  const { summary, loading, error, refresh } = useUsage();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-300">
              <Gauge className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Usage and plans</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Rolling capacity</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Lumora measures completed, expensive actions over the previous 24 hours. Capacity returns continuously as each action ages out.
            </p>
          </div>
          {summary && (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Current plan</p>
              <p className="mt-1 text-lg font-semibold text-cyan-200">{titleCasePlan(summary.plan)}</p>
            </div>
          )}
        </div>

        {loading && !summary && (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-800 bg-[#101722] text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading current usage…
          </div>
        )}

        {error && !summary && (
          <div role="alert" className="rounded-2xl border border-rose-800/60 bg-rose-950/30 p-5 text-sm text-rose-200">
            <p>{error}</p>
            <button type="button" onClick={() => void refresh()} className="mt-3 rounded-lg border border-rose-700 px-3 py-1.5 text-xs font-semibold hover:bg-rose-900/40">Try again</button>
          </div>
        )}

        {summary && (
          <>
            <section aria-labelledby="usage-breakdown-title">
              <h2 id="usage-breakdown-title" className="mb-3 text-sm font-semibold text-white">Previous 24 hours</h2>
              <div className="grid gap-4 lg:grid-cols-3">
                {ACTIONS.map(({ type, label, description, icon: Icon }) => {
                  const action = summary.perAction[type];
                  const percent = Math.min(100, (action.used / action.limit) * 100);
                  return (
                    <article key={type} className="rounded-2xl border border-slate-800/80 bg-[#101722] p-5 shadow-lg shadow-black/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-cyan-300"><Icon className="h-4 w-4" /></span>
                          <div><h3 className="text-sm font-semibold text-white">{label}</h3><p className="text-[11px] text-slate-500">{description}</p></div>
                        </div>
                        <span className="font-mono text-sm text-slate-200">{action.used}/{action.limit}</span>
                      </div>
                      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-[width]" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="mt-3 text-xs font-medium text-slate-300">{action.remaining} action{action.remaining === 1 ? '' : 's'} remaining</p>
                      <p className="mt-1 min-h-8 text-[11px] leading-relaxed text-slate-500">
                        {action.used > 0 ? formatRecoveryTime(action.nextAvailableAt) : 'No capacity is currently waiting to recover.'}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="plan-comparison-title" className="overflow-hidden rounded-2xl border border-slate-800/80 bg-[#101722]">
              <div className="border-b border-slate-800/80 px-5 py-4">
                <h2 id="plan-comparison-title" className="text-sm font-semibold text-white">Plan comparison</h2>
                <p className="mt-1 text-xs text-slate-500">Every allowance uses the same rolling 24-hour window.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-slate-900/50 text-slate-500">
                    <tr><th className="px-5 py-3 font-medium">Plan</th><th className="px-5 py-3 font-medium">Chat</th><th className="px-5 py-3 font-medium">Ingestion</th><th className="px-5 py-3 font-medium">AI Actions</th></tr>
                  </thead>
                  <tbody>
                    {PLANS.map((plan) => (
                      <tr key={plan} className={`border-t border-slate-800/70 ${summary.plan === plan ? 'bg-cyan-400/[0.05]' : ''}`}>
                        <th className="px-5 py-4 font-semibold text-white">{titleCasePlan(plan)} {summary.plan === plan && <span className="ml-2 rounded-full bg-cyan-400/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-cyan-300">Current</span>}</th>
                        <td className="px-5 py-4 text-slate-300">{summary.planLimits[plan].CHAT}</td>
                        <td className="px-5 py-4 text-slate-300">{summary.planLimits[plan].INGESTION}</td>
                        <td className="px-5 py-4 text-slate-300">{summary.planLimits[plan].AI_ACTION}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
