import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { useAccess } from '../components/payments/AccessProvider';
import { usePaymentHistory } from '../components/payments/usePaymentHistory';
import { CheckoutDialog } from '../components/payments/CheckoutDialog';
import { CurrentPlanCard } from '../components/billing/CurrentPlanCard';
import { PaymentHistoryTable } from '../components/billing/PaymentHistoryTable';
import type { PaidPlan } from '../lib/payments/config';

export function BillingPage() {
  const access = useAccess();
  const history = usePaymentHistory();
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([access.refresh(), history.refresh()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckoutSuccess = () => {
    void history.refresh();
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="border-b border-cyan-400/10 pb-7">
          <div className="mb-2 flex items-center gap-2 text-cyan-300">
            <span className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] p-1.5 shadow-[0_0_16px_rgba(34,211,238,0.08)]">
              <CreditCard className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Billing</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Manage your plan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Current access, purchase history, and renewal — all in one place.
          </p>
        </div>

        {access.loading && !access.plan ? (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-800 bg-[#101722] text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your billing details…
          </div>
        ) : access.error && !access.plan ? (
          <div role="alert" className="rounded-2xl border border-rose-800/60 bg-rose-950/30 p-5 text-sm text-rose-200">
            <p>{access.error}</p>
            <button
              type="button"
              onClick={() => void access.refresh()}
              className="mt-3 rounded-lg border border-rose-700 px-3 py-1.5 text-xs font-semibold hover:bg-rose-900/40"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <CurrentPlanCard
              plan={access.plan}
              planExpiresAt={access.planExpiresAt}
              history={history.history}
              onRenew={(plan) => setCheckoutPlan(plan)}
              onUpgrade={(plan) => setCheckoutPlan(plan)}
              onRefresh={() => void handleRefresh()}
              refreshing={refreshing}
            />

            <section aria-labelledby="payment-history-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="payment-history-title" className="text-sm font-semibold text-white">Payment history</h2>
                {history.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
              </div>
              {history.error ? (
                <div role="alert" className="rounded-2xl border border-rose-800/60 bg-rose-950/30 p-5 text-sm text-rose-200">
                  {history.error}
                </div>
              ) : (
                <PaymentHistoryTable history={history.history} />
              )}
            </section>
          </>
        )}
      </div>

      {checkoutPlan && (
        <CheckoutDialog
          isOpen={Boolean(checkoutPlan)}
          plan={checkoutPlan}
          currentPlan={access.plan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </DashboardLayout>
  );
}
