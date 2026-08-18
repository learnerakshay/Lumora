import React, { useId, useState } from 'react';
import { Loader2, Tag, X } from 'lucide-react';
import { postPaymentsApi, type QuoteResponse } from './payments-api';
import { formatInr } from '../../lib/payments/pricing-presentation';
import type { PaidPlan } from '../../lib/payments/config';

type CouponStatus = 'idle' | 'checking' | 'applied' | 'error';

interface CouponFieldProps {
  plan: PaidPlan;
  disabled?: boolean;
  onApplied: (quote: QuoteResponse) => void;
  onRemoved: () => void;
}

// Coupon Apply/Remove UX. The server (POST /quote) is the sole source of
// truth for original price, discount, and final price — this component
// never computes a discount itself, only displays what the server
// returned. Covers valid / invalid / expired / not-applicable / limit /
// already-used purely by surfacing the server's own message for each
// COUPON_* code (src/lib/payments/coupon.ts already has distinct,
// human-readable text for every one of those cases).
export function CouponField({ plan, disabled, onApplied, onRemoved }: CouponFieldProps) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<CouponStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applied, setApplied] = useState<QuoteResponse | null>(null);
  const errorId = useId();

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed || status === 'checking') return;
    setStatus('checking');
    setErrorMessage(null);
    const result = await postPaymentsApi<QuoteResponse>('/quote', { plan, couponCode: trimmed });
    if (result.status === 'error') {
      setStatus('error');
      setErrorMessage(result.message);
      return;
    }
    setStatus('applied');
    setApplied(result.data);
    onApplied(result.data);
  };

  const handleRemove = () => {
    setCode('');
    setStatus('idle');
    setErrorMessage(null);
    setApplied(null);
    onRemoved();
  };

  if (status === 'applied' && applied) {
    return (
      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/25 p-3.5 shadow-[0_0_24px_rgba(16,185,129,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <Tag className="h-3.5 w-3.5" />
            {applied.couponCode}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-200/70 transition hover:bg-emerald-900/40 hover:text-emerald-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <X className="h-3 w-3" />
            Remove
          </button>
        </div>
        <dl className="mt-2.5 space-y-1 text-[11px] text-emerald-100/80">
          <div className="flex justify-between">
            <dt>Original price</dt>
            <dd className="font-mono">{formatInr(applied.baseAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Discount</dt>
            <dd className="font-mono">−{formatInr(applied.discountAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-emerald-900/50 pt-1 font-semibold text-emerald-200">
            <dt>You pay</dt>
            <dd className="font-mono">{formatInr(applied.finalAmount)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="coupon-code-input" className="mb-1.5 block text-[11px] font-medium text-slate-400">
        Have a coupon?
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code-input"
          type="text"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (status === 'error') setStatus('idle');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleApply();
            }
          }}
          placeholder="Enter coupon code"
          disabled={disabled || status === 'checking'}
          aria-invalid={status === 'error'}
          aria-describedby={status === 'error' ? errorId : undefined}
          className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-sm text-white placeholder-slate-500 transition-colors focus:border-cyan-400/70 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={disabled || !code.trim() || status === 'checking'}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          {status === 'checking' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Apply
        </button>
      </div>
      {status === 'error' && errorMessage && (
        <p id={errorId} role="alert" className="mt-1.5 text-[11px] text-rose-300">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
