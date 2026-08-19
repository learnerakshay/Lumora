import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Check, Clock3, Gauge, GraduationCap, Loader2, MessageSquare, Sparkles, Upload } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { CheckoutDialog } from '../components/payments/CheckoutDialog';
import { formatRecoveryLabel } from '../components/usage/UsageLimitNotice';
import { useUsage } from '../components/usage/UsageProvider';
import { PLAN_NAMES, type MeteredUsageAction, type PlanName } from '../lib/usage/config';
import { PRICING_PLANS } from '../lib/payments/pricing-presentation';
import type { PaidPlan } from '../lib/payments/config';

const ACTIONS: Array<{
  type: MeteredUsageAction;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconWrap: string;
  iconColor: string;
  bar: string;
  glow: string;
}> = [
  {
    type: 'CHAT', label: 'Grounded chat', description: 'Completed AI answers', icon: MessageSquare,
    iconWrap: 'border-cyan-400/20 bg-cyan-400/[0.07]', iconColor: 'text-cyan-300',
    bar: 'from-cyan-500 to-blue-500', glow: 'shadow-[0_0_10px_rgba(34,211,238,0.45)]',
  },
  {
    type: 'INGESTION', label: 'Source ingestion', description: 'Sources processed and indexed', icon: Upload,
    iconWrap: 'border-emerald-400/20 bg-emerald-400/[0.07]', iconColor: 'text-emerald-300',
    bar: 'from-emerald-500 to-teal-500', glow: 'shadow-[0_0_10px_rgba(16,185,129,0.45)]',
  },
  {
    type: 'AI_ACTION', label: 'AI Actions', description: 'Completed action workflows', icon: Sparkles,
    iconWrap: 'border-violet-400/20 bg-violet-400/[0.07]', iconColor: 'text-violet-300',
    bar: 'from-purple-500 to-violet-500', glow: 'shadow-[0_0_10px_rgba(168,85,247,0.45)]',
  },
  {
    type: 'SKILL_INTELLIGENCE', label: 'Skill Intelligence', description: 'Resume gap analyses run', icon: Brain,
    iconWrap: 'border-amber-400/20 bg-amber-400/[0.07]', iconColor: 'text-amber-300',
    bar: 'from-amber-500 to-yellow-500', glow: 'shadow-[0_0_10px_rgba(245,158,11,0.45)]',
  },
  {
    type: 'LEARNING_PATH', label: 'Learning Path', description: 'Learning plans built', icon: GraduationCap,
    iconWrap: 'border-indigo-400/20 bg-indigo-400/[0.07]', iconColor: 'text-indigo-300',
    bar: 'from-indigo-500 to-blue-600', glow: 'shadow-[0_0_10px_rgba(99,102,241,0.45)]',
  },
];

function titleCasePlan(plan: PlanName): string {
  return `${plan.slice(0, 1)}${plan.slice(1).toLowerCase()}`;
}

export function UsagePage() {
  const { summary, loading, error, refresh } = useUsage();
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null);

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
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-4 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Current plan</p>
              <p className="mt-1.5 flex items-center gap-2 text-lg font-semibold text-cyan-100">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                Active Tier: {titleCasePlan(summary.plan)}
              </p>
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
                {ACTIONS.map(({ type, label, description, icon: Icon, iconWrap, iconColor, bar, glow }) => {
                  const action = summary.perAction[type];
                  const percent = Math.min(100, (action.used / action.limit) * 100);
                  return (
                    <article key={type} className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-500/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`rounded-xl border p-2 ${iconWrap} ${iconColor}`}><Icon className="h-4 w-4" /></span>
                          <div><h3 className="text-sm font-semibold text-white">{label}</h3><p className="text-[11px] text-slate-500">{description}</p></div>
                        </div>
                        <span className="font-mono text-base font-semibold text-cyan-100">{action.used}<span className="text-slate-500">/{action.limit}</span></span>
                      </div>
                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800/90 shadow-inner">
                        <div className={`h-full rounded-full bg-gradient-to-r ${bar} ${glow} transition-[width] duration-300`} style={{ width: `${percent}%` }} />
                      </div>
                      <p className="mt-3 text-xs font-medium text-slate-200">{action.remaining} action{action.remaining === 1 ? '' : 's'} remaining</p>
                      <p className="mt-1 flex min-h-8 items-center gap-1.5 text-[11px] leading-relaxed text-slate-500">
                        <Clock3 className="h-3 w-3 shrink-0 text-slate-600" />
                        {action.used > 0 ? formatRecoveryLabel(action.nextAvailableAt) : 'No capacity currently waiting to recover'}
                      </p>
                      {action.nextAvailableAt && <p className="text-[10px] text-slate-600">{new Date(action.nextAvailableAt).toLocaleString()}</p>}
                    </article>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="plan-comparison-title" className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-lg backdrop-blur-xl">
              <div className="border-b border-slate-800/80 px-5 py-5">
                <h2 id="plan-comparison-title" className="text-sm font-semibold text-white">Plan comparison</h2>
                <p className="mt-1 text-xs text-slate-500">Upgrade according to your needs. Every allowance uses the same rolling 12-hour window.</p>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-3">
                {PRICING_PLANS.map((card) => {
                  const current = summary.plan === card.plan;
                  // Only a strictly higher tier than the caller's own plan gets an
                  // upgrade CTA. Buying a lower or equal tier while a higher one is
                  // active would be a wasted purchase — resolveEntitledPlan always
                  // grants the highest unexpired tier regardless.
                  const isUpgrade = !current && PLAN_NAMES.indexOf(card.plan) > PLAN_NAMES.indexOf(summary.plan);
                  return (
                    <article
                      key={card.plan}
                      className={`flex flex-col rounded-2xl border p-5 transition-all ${current ? 'border-cyan-500/60 bg-slate-900/90 shadow-[0_0_25px_rgba(6,182,212,0.15)]' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white">{titleCasePlan(card.plan)}</h3>
                        {current && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200">
                            <Check className="h-2.5 w-2.5" />Current Access
                          </span>
                        )}
                      </div>
                      <p className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-white">{card.priceLabel}</span>
                        {card.isPaid && <span className="text-xs text-slate-500">/ {card.accessDays} days</span>}
                      </p>
                      <ul className="mt-4 space-y-2.5 text-xs text-slate-300">
                        <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-500"><MessageSquare className="h-3 w-3" />Chat</span><strong className="font-mono text-slate-100">{card.limits.CHAT}</strong></li>
                        <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-500"><Upload className="h-3 w-3" />Ingestion</span><strong className="font-mono text-slate-100">{card.limits.INGESTION}</strong></li>
                        <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-500"><Sparkles className="h-3 w-3" />AI Actions</span><strong className="font-mono text-slate-100">{card.limits.AI_ACTION}</strong></li>
                        <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-500"><Brain className="h-3 w-3" />Skill Intelligence</span><strong className="font-mono text-slate-100">{card.limits.SKILL_INTELLIGENCE}</strong></li>
                        <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-500"><GraduationCap className="h-3 w-3" />Learning Path</span><strong className="font-mono text-slate-100">{card.limits.LEARNING_PATH}</strong></li>
                      </ul>
                      <div className="mt-5 border-t border-slate-800/70 pt-4">
                        {current ? (
                          <span className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-[11px] font-medium text-emerald-300">
                            <Check className="h-3.5 w-3.5" />Current plan
                          </span>
                        ) : isUpgrade ? (
                          <button
                            type="button"
                            onClick={() => setCheckoutPlan(card.plan as PaidPlan)}
                            className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                          >
                            Upgrade to {titleCasePlan(card.plan)}
                          </button>
                        ) : (
                          <p className="text-center text-[11px] text-slate-600">Included in your current plan</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      {checkoutPlan && (
        <CheckoutDialog
          isOpen={Boolean(checkoutPlan)}
          plan={checkoutPlan}
          currentPlan={summary?.plan ?? null}
          onClose={() => setCheckoutPlan(null)}
        />
      )}
    </DashboardLayout>
  );
}
