import React from 'react';
import { Brain, Check, Gauge, Loader2, MessageSquare, Sparkles, Upload } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { formatRecoveryLabel } from '../components/usage/UsageLimitNotice';
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
  { type: 'SKILL_INTELLIGENCE', label: 'Skill Intelligence', description: 'Resume gap analyses run', icon: Brain },
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
        <div className="relative flex flex-wrap items-end justify-between gap-4 border-b border-cyan-400/10 pb-7">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-300">
              <span className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] p-1.5 shadow-[0_0_16px_rgba(34,211,238,0.08)]"><Gauge className="h-3.5 w-3.5" /></span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Usage and plans</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Rolling capacity</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Lumora measures completed, expensive actions over the previous 12 hours. Capacity returns continuously as each action ages out.
            </p>
          </div>
          {summary && (
            <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/[0.11] to-slate-900/60 px-5 py-3.5 text-right shadow-[0_10px_30px_rgba(0,0,0,0.14)]">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Current plan</p>
              <p className="mt-1 text-lg font-semibold text-cyan-100">{titleCasePlan(summary.plan)}</p>
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
              <h2 id="usage-breakdown-title" className="mb-3 text-sm font-semibold text-white">Previous 12 hours</h2>
              <div className="grid gap-4 lg:grid-cols-3">
                {ACTIONS.map(({ type, label, description, icon: Icon }) => {
                  const action = summary.perAction[type];
                  const percent = Math.min(100, (action.used / action.limit) * 100);
                  return (
                    <article key={type} className="rounded-2xl border border-slate-700/65 bg-gradient-to-br from-[#121b28] to-[#101722] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_12px_28px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:border-cyan-400/25">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="rounded-xl border border-cyan-400/18 bg-cyan-400/[0.06] p-2 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.05)]"><Icon className="h-4 w-4" /></span>
                          <div><h3 className="text-sm font-semibold text-white">{label}</h3><p className="text-[11px] text-slate-500">{description}</p></div>
                        </div>
                        <span className="font-mono text-base font-semibold text-cyan-100">{action.used}<span className="text-slate-500">/{action.limit}</span></span>
                      </div>
                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800/90 shadow-inner">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-[width]" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="mt-3 text-xs font-medium text-slate-200">{action.remaining} action{action.remaining === 1 ? '' : 's'} remaining</p>
                      <p className="mt-1 min-h-8 text-[11px] leading-relaxed text-slate-500">
                        {action.used > 0 ? formatRecoveryLabel(action.nextAvailableAt) : 'No capacity currently waiting to recover'}
                      </p>
                      {action.nextAvailableAt && <p className="text-[10px] text-slate-600">{new Date(action.nextAvailableAt).toLocaleString()}</p>}
                    </article>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="plan-comparison-title" className="overflow-hidden rounded-2xl border border-slate-700/65 bg-[#101722] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="border-b border-slate-800/80 px-5 py-5">
                <h2 id="plan-comparison-title" className="text-sm font-semibold text-white">Plan comparison</h2>
                <p className="mt-1 text-xs text-slate-500">Upgrade according to your needs. Every allowance uses the same rolling 12-hour window.</p>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-3">
                {PLANS.map((plan) => {
                  const current = summary.plan === plan;
                  return <article key={plan} className={`rounded-xl border p-4 ${current ? 'border-cyan-400/40 bg-cyan-400/[0.07] shadow-[0_0_20px_rgba(34,211,238,0.06)]' : 'border-slate-800 bg-slate-900/45'}`}>
                    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">{titleCasePlan(plan)}</h3>{current && <span className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.09] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200">Current</span>}</div>
                    <ul className="mt-4 space-y-2.5 text-xs text-slate-300">
                      <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-500"><MessageSquare className="h-3 w-3" />Chat</span><strong className="font-mono text-slate-100">{summary.planLimits[plan].CHAT}</strong></li>
                      <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-500"><Upload className="h-3 w-3" />Ingestion</span><strong className="font-mono text-slate-100">{summary.planLimits[plan].INGESTION}</strong></li>
                      <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-500"><Sparkles className="h-3 w-3" />AI Actions</span><strong className="font-mono text-slate-100">{summary.planLimits[plan].AI_ACTION}</strong></li>
                      <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-500"><Brain className="h-3 w-3" />Skill Intelligence</span><strong className="font-mono text-slate-100">{summary.planLimits[plan].SKILL_INTELLIGENCE}</strong></li>
                    </ul>
                    {current && <p className="mt-4 flex items-center gap-1.5 text-[10px] font-medium text-cyan-200"><Check className="h-3 w-3" /> Your current access</p>}
                  </article>;
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
