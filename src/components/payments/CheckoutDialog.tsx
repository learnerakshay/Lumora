import React, { useEffect, useReducer, useRef, useState } from 'react';
import { ShieldCheck, Sparkles, X } from 'lucide-react';
import {
  INITIAL_CHECKOUT_MACHINE_STATE,
  checkoutReducer,
  isTerminalState,
} from '../../lib/payments/checkout-machine';
import { formatInr, getPlanCard } from '../../lib/payments/pricing-presentation';
import { launchAmountFor, type PaidPlan } from '../../lib/payments/config';
import { stackingCopyFor } from '../../lib/payments/access-presentation';
import { useAuth } from '../AuthProvider';
import { useAccess } from './AccessProvider';
import { notifyUsageChanged } from '../usage/UsageProvider';
import { useRazorpayCheckout, type RazorpayCheckoutOptions } from './useRazorpayCheckout';
import { CouponField } from './CouponField';
import { PaymentStatusPanel, type RecoveryState } from './PaymentStatusPanel';
import {
  getPaymentsApi,
  postPaymentsApi,
  type AccessRefreshResponse,
  type OrderResponse,
  type QuoteResponse,
  type VerifyResponse,
} from './payments-api';
import type { PaymentHistoryRecord } from './usePaymentHistory';
import type { PlanName } from '../../lib/usage/config';

interface CheckoutDialogProps {
  isOpen: boolean;
  plan: PaidPlan;
  onClose: () => void;
  onSuccess?: () => void;
  // The user's plan BEFORE this purchase, when known (e.g. opened from
  // /billing's Renew/Upgrade buttons, or from a pricing card while
  // already signed in). Purely presentational — only used to pick which
  // honest stacking sentence to show (renewal vs upgrade vs fresh
  // purchase). Never sent to the server; POST /order doesn't take it.
  currentPlan?: PlanName | null;
}

// Real Razorpay Standard Checkout, wired end to end onto the Phase 3A
// foundation: the pure checkout-machine drives which panel renders, the
// Razorpay loader hook loads Checkout.js on demand, POST /order and
// POST /order/verify are the sole source of the charged amount, and
// success calls notifyUsageChanged() + AccessProvider.refresh() so the
// rest of the app reflects the new plan without a manual reload.
export function CheckoutDialog({ isOpen, plan, onClose, onSuccess, currentPlan = null }: CheckoutDialogProps) {
  const { user } = useAuth();
  const access = useAccess();
  const razorpay = useRazorpayCheckout();

  const [machine, dispatch] = useReducer(checkoutReducer, INITIAL_CHECKOUT_MACHINE_STATE);
  const [appliedQuote, setAppliedQuote] = useState<QuoteResponse | null>(null);
  const [resultPlan, setResultPlan] = useState<PlanName | null>(null);
  const [resultExpiresAt, setResultExpiresAt] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryState>({ status: 'idle', message: null });
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Tracks the live Razorpay overlay instance (if any is currently open)
  // so it can be explicitly closed when this dialog closes/unmounts.
  // Razorpay appends its own container to document.body, entirely outside
  // React's tree — without this, closing our dialog while Razorpay is open
  // leaves that overlay behind as a "zombie" that can intercept clicks
  // meant for whatever renders next (verified: it steals focus and blocks
  // a freshly-reopened dialog's own controls).
  const razorpayInstanceRef = useRef<import('./useRazorpayCheckout').RazorpayInstance | null>(null);

  const planCard = getPlanCard(plan);
  const baseAmount = launchAmountFor(plan);
  const displayedAmount = appliedQuote?.finalAmount ?? baseAmount;
  // Purely presentational: which honest sentence to show above the Pay
  // button (renewal / upgrade / fresh purchase). currentPlan defaults to
  // null when the caller doesn't know it (e.g. a signed-out visitor who
  // just signed in), in which case this reads as a fresh purchase.
  const stackingCopy = currentPlan ? stackingCopyFor(currentPlan, plan) : null;

  // Reset to a clean slate every time the dialog is (re)opened for a plan,
  // so a previous attempt's order/coupon/error never leaks into a new one.
  useEffect(() => {
    if (!isOpen) return;
    dispatch({ type: 'RESET' });
    setAppliedQuote(null);
    setResultPlan(null);
    setResultExpiresAt(null);
    setRecovery({ status: 'idle', message: null });
  }, [isOpen, plan]);

  // Focus management: move focus into the dialog on open (the close
  // button is always present, so it's a reliable landing spot regardless
  // of which view is showing), and restore it to whatever triggered the
  // dialog once it closes — a keyboard/screen-reader user should never
  // lose their place on the page behind it.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // A macrotask (setTimeout), not requestAnimationFrame: RAF is tied to
    // the browser's paint/compositing cycle and can be indefinitely
    // deferred or simply never fire in a backgrounded/non-compositing tab
    // (verified directly in this environment) — focus management must not
    // depend on the page actually being painted.
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  // Explicitly close any live Razorpay overlay when this dialog closes or
  // unmounts — see the razorpayInstanceRef comment above for why this
  // can't be left to happen implicitly. Callers mount this component only
  // while isOpen is true and unmount it to close (rather than re-rendering
  // with isOpen=false), so the cleanup function — which fires on unmount —
  // is what actually runs this, not the effect body.
  //
  // Calling rzp.close() alone was verified NOT to remove the overlay in
  // practice (confirmed in a live Test Mode session: the container stayed
  // in the DOM, fully visible and interactive, well after close() was
  // called) — so this also removes any `.razorpay-container` node
  // Checkout.js appended to document.body directly, as a guaranteed
  // fallback regardless of what close() actually does internally.
  useEffect(() => {
    if (!isOpen) return;
    return () => {
      razorpayInstanceRef.current?.close();
      razorpayInstanceRef.current = null;
      document.querySelectorAll('.razorpay-container').forEach((node) => node.remove());
    };
  }, [isOpen]);

  // Escape closes the dialog; Tab is trapped inside it so keyboard focus
  // can never silently leave to the page underneath while a payment may
  // be in flight. Recomputed fresh on every Tab press (rather than once
  // on open) since the focusable set changes as the form view swaps for
  // the status panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // A fresh Razorpay order is created on every single Pay click — a
  // retry never reuses a previous attempt's order id.
  const runCheckout = async () => {
    dispatch({ type: 'START', plan, couponCode: appliedQuote?.couponCode ?? null });

    const orderResult = await postPaymentsApi<OrderResponse>('/order', {
      plan,
      couponCode: appliedQuote?.couponCode ?? undefined,
    });
    if (orderResult.status === 'error') {
      dispatch({ type: 'ORDER_FAILED', code: orderResult.code, message: orderResult.message });
      return;
    }
    dispatch({
      type: 'ORDER_CREATED',
      orderId: orderResult.data.orderId,
      amount: orderResult.data.amount,
      currency: orderResult.data.currency,
    });

    const loaded = await razorpay.ensureLoaded();
    if (!loaded) {
      dispatch({
        type: 'GATEWAY_LOAD_FAILED',
        message: razorpay.error || 'Could not load the payment gateway. Please try again.',
      });
      return;
    }
    dispatch({ type: 'GATEWAY_READY' });

    if (!window.Razorpay) {
      dispatch({ type: 'GATEWAY_LOAD_FAILED', message: 'Could not load the payment gateway. Please try again.' });
      return;
    }

    const options: RazorpayCheckoutOptions = {
      key: orderResult.data.keyId,
      order_id: orderResult.data.orderId,
      amount: orderResult.data.amount,
      currency: orderResult.data.currency,
      name: 'Lumora',
      description: `${plan} plan — 30 days access`,
      prefill: {
        name: user?.fullName || undefined,
        email: user?.email || undefined,
      },
      theme: { color: '#22d3ee' },
      // Real Razorpay Standard Checkout — no `method` restriction is set,
      // so Cards, UPI, Netbanking, and Wallets all surface exactly as
      // Razorpay's own account configuration allows.
      handler: (response) => {
        void handleRazorpaySuccess(response);
      },
      modal: {
        ondismiss: () => dispatch({ type: 'DISMISSED' }),
      },
    };

    const rzp = new window.Razorpay(options);
    razorpayInstanceRef.current = rzp;
    rzp.on('payment.failed', (response) => {
      dispatch({
        type: 'RAZORPAY_FAILED',
        code: response.error.code,
        message: response.error.description || 'Payment failed. No charge was completed.',
      });
    });
    rzp.open();
  };

  const handleRazorpaySuccess = async (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    dispatch({ type: 'RAZORPAY_SUCCESS', paymentId: response.razorpay_payment_id });

    const verifyResult = await postPaymentsApi<VerifyResponse>('/order/verify', {
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    });

    if (verifyResult.status === 'error') {
      if (verifyResult.code === 'PAYMENT_NOT_CAPTURED') {
        dispatch({ type: 'VERIFY_NOT_CAPTURED', message: verifyResult.message });
        return;
      }
      dispatch({ type: 'VERIFY_FAILED', code: verifyResult.code, message: verifyResult.message });
      return;
    }

    dispatch({ type: 'VERIFY_OK' });
    setResultPlan(verifyResult.data.plan);
    setResultExpiresAt(verifyResult.data.planExpiresAt);

    // Reflect the upgraded plan/limits everywhere else in the app
    // immediately — no manual reload required.
    notifyUsageChanged();
    await access.refresh();

    dispatch({ type: 'ACTIVATED' });
    onSuccess?.();
  };

  // Recovery path for `dismissed` and `awaiting_bank_confirmation`: re-reads
  // the specific order's real status rather than guessing from a generic
  // access refresh, so "Check status" only ever reports what actually
  // happened to THIS order.
  const checkStatus = async () => {
    const orderId = machine.context.orderId;
    if (!orderId) return;
    setRecovery({ status: 'checking', message: null });

    await postPaymentsApi<AccessRefreshResponse>('/access/refresh', { orderId });
    const historyResult = await getPaymentsApi<{ payments: PaymentHistoryRecord[] }>('/payments');
    const match =
      historyResult.status === 'ok'
        ? historyResult.data.payments.find((record) => record.providerOrderId === orderId)
        : undefined;

    if (match?.status === 'CAPTURED') {
      notifyUsageChanged();
      await access.refresh();
      setResultPlan(match.plan);
      setResultExpiresAt(match.accessUntil);
      if (machine.state === 'awaiting_bank_confirmation') {
        dispatch({ type: 'VERIFY_OK' });
        dispatch({ type: 'ACTIVATED' });
        onSuccess?.();
      } else {
        setRecovery({ status: 'captured', message: 'Payment confirmed — your plan has been updated.' });
      }
      return;
    }

    setRecovery({
      status: 'not_found',
      message: 'No confirmed payment found yet for this order. If you completed payment, wait a moment and check again.',
    });
  };

  const handleRetry = () => dispatch({ type: 'RETRY' });

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    // Only dismiss-by-backdrop while idle or already at a resolved/terminal
    // state — never mid-flight, where an accidental click shouldn't hide a
    // payment that's actually in progress.
    if (machine.state === 'idle' || isTerminalState(machine.state)) onClose();
  };

  const isFormView = machine.state === 'idle';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-dialog-title"
        className="animate-fade-in relative flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-700/70 bg-[#111925] shadow-[0_32px_90px_rgba(0,0,0,0.6)] sm:rounded-3xl"
      >
        <div className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full bg-cyan-400/[0.08] blur-3xl" aria-hidden="true" />

        <header className="relative flex items-center justify-between gap-3 border-b border-slate-800/80 bg-gradient-to-br from-slate-900/70 to-transparent p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/[0.09] text-cyan-300">
              {plan === 'MAX' ? <Sparkles className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </span>
            <div>
              <h2 id="checkout-dialog-title" className="text-base font-semibold text-white">
                {isFormView ? `Get ${plan}` : `${plan} checkout`}
              </h2>
              <p className="text-[11px] text-slate-400">One-time payment · 30 days access · No auto-renewal</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative overflow-y-auto p-5">
          {isFormView ? (
            <div key="form" className="animate-fade-in space-y-5">
              <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/[0.07] to-slate-900/40 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-slate-200">{plan} plan</span>
                  <span className="flex items-baseline gap-2">
                    {planCard.listPriceLabel && (
                      <span className="text-xs text-slate-500 line-through">{planCard.listPriceLabel}</span>
                    )}
                    <span className="font-mono text-2xl font-bold tracking-tight text-white">{formatInr(displayedAmount)}</span>
                  </span>
                </div>
                {stackingCopy && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-cyan-200/80">
                    <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
                    {stackingCopy.detail}
                  </p>
                )}
              </div>

              <CouponField
                plan={plan}
                onApplied={(quote) => setAppliedQuote(quote)}
                onRemoved={() => setAppliedQuote(null)}
              />

              <button
                type="button"
                onClick={() => void runCheckout()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-cyan-500/30 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111925]"
              >
                Pay {formatInr(displayedAmount)}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
                <ShieldCheck className="h-3 w-3" />
                Secured by Razorpay · Cards, UPI, Netbanking &amp; Wallets supported
              </p>
            </div>
          ) : (
            <PaymentStatusPanel
              key={machine.state}
              state={machine.state}
              errorMessage={machine.context.errorMessage}
              errorCode={machine.context.errorCode}
              resultPlan={resultPlan}
              resultExpiresAt={resultExpiresAt}
              recovery={recovery}
              onRetry={handleRetry}
              onCheckStatus={() => void checkStatus()}
              onDone={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
