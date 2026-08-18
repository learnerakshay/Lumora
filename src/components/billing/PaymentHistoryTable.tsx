import React from 'react';
import { CheckCircle2, Clock, CreditCard, Tag, XCircle } from 'lucide-react';
import { formatInr } from '../../lib/payments/pricing-presentation';
import type { PaymentHistoryRecord } from '../payments/usePaymentHistory';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMethod(method: string | null): string {
  if (!method) return '—';
  return method.charAt(0).toUpperCase() + method.slice(1);
}

const STATUS_STYLE: Record<PaymentHistoryRecord['status'], { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  CAPTURED: { label: 'Paid', className: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300', Icon: CheckCircle2 },
  CREATED: { label: 'Awaiting confirmation', className: 'border-amber-700/50 bg-amber-950/25 text-amber-300', Icon: Clock },
  FAILED: { label: 'Failed', className: 'border-rose-800/50 bg-rose-950/30 text-rose-300', Icon: XCircle },
  REFUNDED: { label: 'Refunded', className: 'border-slate-700 bg-slate-900/60 text-slate-300', Icon: CreditCard },
};

// Every figure here is read straight off the historical Payment row —
// never recomputed from current PLAN_LIMITS/PLAN_PRICING_PAISE. A past
// payment's real amount/discount must stay accurate even if today's
// pricing later changes.
export function PaymentHistoryTable({ history }: { history: readonly PaymentHistoryRecord[] }) {
  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
        <CreditCard className="mx-auto h-5 w-5 text-slate-600" />
        <p className="mt-3 text-sm font-medium text-slate-300">No payment history yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
          Purchases will appear here once you upgrade to a paid plan.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#101722]">
      <ul className="divide-y divide-slate-800/70">
        {history.map((record) => {
          const status = STATUS_STYLE[record.status];
          const StatusIcon = status.Icon;
          return (
            <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-900/40">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${status.className}`}>
                  <StatusIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    {record.plan}
                    {record.couponId && (
                      <span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                        <Tag className="h-2.5 w-2.5" />
                        Coupon applied
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatDate(record.createdAt)} · {formatMethod(record.method)}
                  </p>
                  {record.status === 'FAILED' && record.failureReason && (
                    <p className="mt-0.5 text-[11px] text-rose-300/80">{record.failureReason}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  {record.discountAmount > 0 && (
                    <p className="text-[10px] text-slate-500 line-through">{formatInr(record.amount + record.discountAmount)}</p>
                  )}
                  <p className="font-mono text-sm font-semibold text-white">{formatInr(record.amount)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${status.className}`}>
                  {status.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
