import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { CheckoutState } from '../../lib/payments/checkout-machine';
import type { PlanName } from '../../lib/usage/config';

export type RecoveryStatus = 'idle' | 'checking' | 'not_found' | 'captured';

export interface RecoveryState {
  status: RecoveryStatus;
  message: string | null;
}

interface PaymentStatusPanelProps {
  state: CheckoutState;
  errorMessage: string | null;
  errorCode: string | null;
  resultPlan: PlanName | null;
  resultExpiresAt: string | null;
  recovery: RecoveryState;
  onRetry: () => void;
  onCheckStatus: () => void;
  onDone: () => void;
}

function titleCasePlan(plan: PlanName): string {
  return `${plan.slice(0, 1)}${plan.slice(1).toLowerCase()}`;
}

// Every non-idle checkout state renders here with visible text and at
// least one exit control — never a bare spinner with nothing to do.
// `dismissed` is rendered distinctly from `failed`: closing the Razorpay
// window is not a payment failure, so its copy and iconography must never
// say "failed".
export function PaymentStatusPanel({
  state,
  errorMessage,
  errorCode,
  resultPlan,
  resultExpiresAt,
  recovery,
  onRetry,
  onCheckStatus,
  onDone,
}: PaymentStatusPanelProps) {
  if (state === 'creating_order') {
    return <Working icon={<Loader2 className="h-6 w-6 animate-spin text-cyan-300" />} text="Creating your order…" />;
  }
  if (state === 'gateway_opening') {
    return <Working icon={<Loader2 className="h-6 w-6 animate-spin text-cyan-300" />} text="Opening the secure payment window…" />;
  }
  if (state === 'awaiting_payment') {
    return <Working icon={<Loader2 className="h-6 w-6 animate-spin text-cyan-300" />} text="Complete your payment in the Razorpay window." />;
  }
  if (state === 'verifying') {
    return <Working icon={<Loader2 className="h-6 w-6 animate-spin text-cyan-300" />} text="Verifying your payment…" />;
  }
  if (state === 'activating') {
    return <Working icon={<Loader2 className="h-6 w-6 animate-spin text-cyan-300" />} text="Activating your new plan…" />;
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-700/60 bg-emerald-950/50 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <div>
          <p className="text-base font-semibold text-white">Payment successful</p>
          <p className="mt-1 text-sm text-slate-400">
            {resultPlan ? `You're now on ${titleCasePlan(resultPlan)}.` : 'Your plan has been updated.'}
            {resultExpiresAt && ` Access until ${new Date(resultExpiresAt).toLocaleDateString()}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="mt-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-cyan-500/15 transition hover:bg-cyan-200"
        >
          Continue
        </button>
      </div>
    );
  }

  if (state === 'failed') {
    const isPaymentsDisabled = errorCode === 'PAYMENTS_DISABLED';
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-800/60 bg-rose-950/40 text-rose-400">
          <XCircle className="h-6 w-6" />
        </span>
        <div>
          <p className="text-base font-semibold text-white">
            {isPaymentsDisabled ? 'Payments are temporarily unavailable' : 'Payment failed'}
          </p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            {errorMessage || 'Something went wrong with your payment. No charge was completed.'}
          </p>
        </div>
        {!isPaymentsDisabled && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-cyan-500/15 transition hover:bg-cyan-200"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (state === 'dismissed') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div>
          <p className="text-base font-semibold text-white">Payment window closed</p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">You closed the payment window. No money was taken.</p>
        </div>
        <RecoveryBlock recovery={recovery} onCheckStatus={onCheckStatus} />
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-cyan-500/15 transition hover:bg-cyan-200"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state === 'awaiting_bank_confirmation') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-800/60 bg-amber-950/40 text-amber-400">
          <Clock className="h-6 w-6" />
        </span>
        <div>
          <p className="text-base font-semibold text-white">Your bank hasn't confirmed yet</p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            {errorMessage || 'If you completed payment, check status below — this can take a moment.'}
          </p>
        </div>
        <RecoveryBlock recovery={recovery} onCheckStatus={onCheckStatus} />
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          Start a new payment
        </button>
      </div>
    );
  }

  return null;
}

function Working({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-10 text-center">
      {icon}
      <p className="text-sm font-medium text-slate-300">{text}</p>
    </div>
  );
}

function RecoveryBlock({ recovery, onCheckStatus }: { recovery: RecoveryState; onCheckStatus: () => void }) {
  return (
    <div className="w-full max-w-xs">
      <button
        type="button"
        onClick={onCheckStatus}
        disabled={recovery.status === 'checking'}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
      >
        {recovery.status === 'checking' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Already paid? Check status
      </button>
      {recovery.status !== 'idle' && recovery.status !== 'checking' && recovery.message && (
        <p
          role="status"
          className={`mt-2 text-[11px] ${recovery.status === 'captured' ? 'text-emerald-300' : 'text-slate-500'}`}
        >
          {recovery.message}
        </p>
      )}
    </div>
  );
}
