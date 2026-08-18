import React, { useEffect, useReducer, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  INITIAL_CHECKOUT_MACHINE_STATE,
  checkoutReducer,
  isTerminalState,
} from '../../lib/payments/checkout-machine';
import { formatInr, getPlanCard } from '../../lib/payments/pricing-presentation';
import { launchAmountFor, type PaidPlan } from '../../lib/payments/config';
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
}

// Real Razorpay Standard Checkout, wired end to end onto the Phase 3A
// foundation: the pure checkout-machine drives which panel renders, the
// Razorpay loader hook loads Checkout.js on demand, POST /order and
// POST /order/verify are the sole source of the charged amount, and
// success calls notifyUsageChanged() + AccessProvider.refresh() so the
// rest of the app reflects the new plan without a manual reload.
export function CheckoutDialog({ isOpen, plan, onClose, onSuccess }: CheckoutDialogProps) {
  const { user } = useAuth();
  const access = useAccess();
  const razorpay = useRazorpayCheckout();

  const [machine, dispatch] = useReducer(checkoutReducer, INITIAL_CHECKOUT_MACHINE_STATE);
  const [appliedQuote, setAppliedQuote] = useState<QuoteResponse | null>(null);
  const [resultPlan, setResultPlan] = useState<PlanName | null>(null);
  const [resultExpiresAt, setResultExpiresAt] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryState>({ status: 'idle', message: null });
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const planCard = getPlanCard(plan);
  const baseAmount = launchAmountFor(plan);
  const displayedAmount = appliedQuote?.finalAmount ?? baseAmount;

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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
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
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-dialog-title"
        className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-700/70 bg-[#111925] shadow-[0_28px_80px_rgba(0,0,0,0.55)] sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50 p-5">
          <div>
            <h2 id="checkout-dialog-title" className="text-base font-semibold text-white">
              {isFormView ? `Get ${plan}` : plan}
            </h2>
            <p className="text-xs text-slate-400">One-time payment · 30 days access · No auto-renewal</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          {isFormView ? (
            <div className="space-y-5">
              <div className="flex items-baseline justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3.5">
                <span className="text-sm text-slate-300">{plan} plan</span>
                <span className="flex items-baseline gap-2">
                  {planCard.listPriceLabel && (
                    <span className="text-xs text-slate-500 line-through">{planCard.listPriceLabel}</span>
                  )}
                  <span className="font-mono text-lg font-semibold text-white">{formatInr(displayedAmount)}</span>
                </span>
              </div>

              <CouponField
                plan={plan}
                onApplied={(quote) => setAppliedQuote(quote)}
                onRemoved={() => setAppliedQuote(null)}
              />

              <button
                type="button"
                onClick={() => void runCheckout()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-md shadow-cyan-500/15 transition hover:bg-cyan-200"
              >
                Pay {formatInr(displayedAmount)}
              </button>
              <p className="text-center text-[11px] text-slate-500">
                Secured by Razorpay · Cards, UPI, Netbanking &amp; Wallets supported
              </p>
            </div>
          ) : (
            <PaymentStatusPanel
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
