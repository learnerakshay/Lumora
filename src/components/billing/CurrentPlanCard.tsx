import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Check, Loader2, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import type { PlanName } from '../../lib/usage/config';
import type { PaidPlan } from '../../lib/payments/config';
import {
  billingStatus,
  daysRemaining,
  expiryBand,
  purchaseDateFrom,
  stackingCopyFor,
} from '../../lib/payments/access-presentation';
import type { PaymentHistoryRecord } from '../payments/usePaymentHistory';

function titleCasePlan(plan: PlanName): string {
  return `${plan.slice(0, 1)}${plan.slice(1).toLowerCase()}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

interface CurrentPlanCardProps {
  plan: PlanName | null;
  planExpiresAt: string | null;
  history: readonly PaymentHistoryRecord[];
  onRenew: (plan: PaidPlan) => void;
  onUpgrade: (plan: PaidPlan) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

// The Billing page's hero: current plan, access window, days remaining,
// and the two purchase actions (Renew / Upgrade), each carrying the
// honest stacking copy from access-presentation.ts — never a proration
// claim, never invented behavior.
export function CurrentPlanCard({
  plan,
  planExpiresAt,
  history,
  onRenew,
  onUpgrade,
  onRefresh,
  refreshing,
}: CurrentPlanCardProps) {
  const status = billingStatus(plan, history);
  const band = expiryBand(plan, planExpiresAt);
  const remaining = daysRemaining(planExpiresAt);
  const accessFrom = purchaseDateFrom(history);
  const isPaid = plan === 'CORE' || plan === 'MAX';

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-[#121b28] to-[#101722] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_45px_rgba(0,0,0,0.18)] sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/[0.06] blur-3xl" aria-hidden="true" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current plan</p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-white">{plan ? titleCasePlan(plan) : '—'}</h2>
            {isPaid && (
              <span className="flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/[0.09] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                <Sparkles className="h-3 w-3" />
                Active
              </span>
            )}
            {status === 'free_expired' && (
              <span className="flex items-center gap-1 rounded-full border border-rose-800/50 bg-rose-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                <TriangleAlert className="h-3 w-3" />
                Expired
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh payment status
        </button>
      </div>

      {/* --- FREE, never purchased ------------------------------------- */}
      {status === 'free_no_history' && (
        <div className="relative mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">You're on the free plan — no purchase on record yet.</p>
          <Link
            to="/pricing"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-cyan-500/15 transition hover:bg-cyan-200"
          >
            View plans
          </Link>
        </div>
      )}

      {/* --- FREE, lapsed paid access ------------------------------------ */}
      {status === 'free_expired' && (
        <div className="relative mt-6 rounded-xl border border-rose-900/40 bg-rose-950/20 p-5">
          <p className="text-sm text-rose-100">
            Your paid access ended{accessFrom ? '' : ' recently'} — you're currently on FREE limits.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onRenew('CORE')}
              className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-cyan-500/15 transition hover:bg-cyan-200"
            >
              Renew CORE
            </button>
            <button
              type="button"
              onClick={() => onRenew('MAX')}
              className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Get MAX
            </button>
          </div>
        </div>
      )}

      {/* --- Active paid plan --------------------------------------------- */}
      {status === 'active' && plan && (
        <>
          <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Calendar className="h-3 w-3" /> Access started
              </p>
              <p className="mt-1.5 text-sm font-medium text-slate-200">{formatDate(accessFrom)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Calendar className="h-3 w-3" /> Access until
              </p>
              <p className="mt-1.5 text-sm font-medium text-slate-200">{formatDate(planExpiresAt)}</p>
            </div>
            <div
              className={`rounded-xl border p-4 ${
                band === 'urgent'
                  ? 'border-amber-600/40 bg-amber-500/[0.06]'
                  : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Days remaining</p>
              <p className={`mt-1.5 text-sm font-semibold ${band === 'urgent' ? 'text-amber-300' : 'text-slate-200'}`}>
                {remaining} day{remaining === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onRenew(plan as PaidPlan)}
              className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-cyan-500/15 transition hover:bg-cyan-200"
            >
              Renew Plan
            </button>
            {plan === 'CORE' && (
              <button
                type="button"
                onClick={() => onUpgrade('MAX')}
                className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Upgrade to MAX
              </button>
            )}
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              {stackingCopyFor(plan, plan as PaidPlan).detail}
            </span>
          </div>
        </>
      )}
    </article>
  );
}
