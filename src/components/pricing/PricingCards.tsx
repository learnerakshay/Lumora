import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import {
  ACCESS_TERMS_LABEL,
  PRICING_PLANS,
  USAGE_WINDOW_LABEL,
  type PlanCard,
} from '../../lib/payments/pricing-presentation';
import type { PaidPlan } from '../../lib/payments/config';
import type { PlanName } from '../../lib/usage/config';

interface PricingCardsProps {
  currentPlan?: PlanName | null;
  onSelectPaid: (plan: PaidPlan) => void;
}

// FREE / CORE / MAX summary cards. Every price and limit comes from
// PRICING_PLANS (src/lib/payments/pricing-presentation.ts), which is
// itself derived from PLAN_LIMITS / PLAN_PRICING_PAISE — nothing here is a
// hardcoded number.
//
// Structural note: the "Most popular" badge is rendered OUTSIDE the
// `.landing-card` element (which sets `overflow: hidden` in
// landing-motion.css for its hover-glow effect) rather than as an
// absolutely-positioned child of it — the badge was previously getting
// clipped by that overflow rule. The outer wrapper carries the badge and
// extra top clearance; the inner card keeps its own clipped hover glow.
export function PricingCards({ currentPlan, onSelectPaid }: PricingCardsProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 pt-4 sm:grid-cols-3 sm:gap-6">
      {PRICING_PLANS.map((card) => (
        <PricingCard
          key={card.plan}
          card={card}
          isCurrent={currentPlan === card.plan}
          onSelectPaid={onSelectPaid}
        />
      ))}
    </div>
  );
}

function PricingCard({
  card,
  isCurrent,
  onSelectPaid,
}: {
  card: PlanCard;
  isCurrent: boolean;
  onSelectPaid: (plan: PaidPlan) => void;
}) {
  const { isSignedIn } = useAuth();
  const isPopular = card.badge === 'Most popular';

  return (
    <div className={`relative ${isPopular ? 'sm:-mt-3' : ''}`}>
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2">
          <span className="flex items-center gap-1 rounded-full border border-cyan-300/60 bg-gradient-to-r from-cyan-300 to-sky-300 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-950 shadow-[0_6px_20px_rgba(34,211,238,0.35)]">
            <Sparkles className="h-3 w-3" />
            Most popular
          </span>
        </div>
      )}

      <article
        data-plan={card.plan}
        className={`landing-card pricing-card-calm relative flex h-full flex-col rounded-2xl border p-6 ${
          isPopular
            ? 'border-cyan-300/45 bg-gradient-to-b from-cyan-400/[0.12] via-[#101826]/95 to-[#0d1420] shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_24px_60px_rgba(8,145,178,0.16)] sm:pt-8'
            : 'border-slate-800/45 bg-[#101826]/90'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className={`text-sm font-semibold uppercase tracking-wide ${isPopular ? 'text-cyan-200' : 'text-slate-300'}`}>
            {card.plan}
          </h3>
          {isCurrent && (
            <span className="rounded-full border border-emerald-800/50 bg-emerald-950/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
              Current
            </span>
          )}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          {card.listPriceLabel && <span className="text-sm text-slate-500 line-through">{card.listPriceLabel}</span>}
          <span className={`text-3xl font-bold tracking-tight ${isPopular ? 'text-white' : 'text-white'}`}>{card.priceLabel}</span>
          {card.isPaid && <span className="text-xs text-slate-500">/ {card.accessDays} days</span>}
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {card.isPaid ? ACCESS_TERMS_LABEL : `Always free · ${USAGE_WINDOW_LABEL}`}
        </p>

        <div className={`my-5 h-px ${isPopular ? 'bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent' : 'bg-slate-800/80'}`} />

        <ul className="space-y-2.5 text-xs text-slate-300">
          {Object.entries(card.limits).map(([action, limit]) => (
            <li key={action} className="flex items-center gap-2">
              <Check className={`h-3.5 w-3.5 shrink-0 ${isPopular ? 'text-cyan-300' : 'text-cyan-400'}`} />
              <span>
                <strong className="font-mono text-slate-100">{limit}</strong> {actionLabel(action)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 pt-0">
          <PlanCta card={card} isCurrent={isCurrent} isSignedIn={isSignedIn} onSelectPaid={onSelectPaid} />
        </div>
      </article>
    </div>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case 'CHAT':
      return `chat answers ${USAGE_WINDOW_LABEL}`;
    case 'INGESTION':
      return `sources ingested ${USAGE_WINDOW_LABEL}`;
    case 'AI_ACTION':
      return `AI Actions ${USAGE_WINDOW_LABEL}`;
    case 'SKILL_INTELLIGENCE':
      return `Skill Intelligence analyses ${USAGE_WINDOW_LABEL}`;
    case 'LEARNING_PATH':
      return `Learning Paths ${USAGE_WINDOW_LABEL}`;
    default:
      return action;
  }
}

function PlanCta({
  card,
  isCurrent,
  isSignedIn,
  onSelectPaid,
}: {
  card: PlanCard;
  isCurrent: boolean;
  isSignedIn: boolean;
  onSelectPaid: (plan: PaidPlan) => void;
}) {
  const isPopular = card.badge === 'Most popular';
  const baseClass =
    'flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f17]';
  const primaryClass = isPopular
    ? `${baseClass} bg-gradient-to-r from-cyan-300 to-sky-300 text-slate-950 shadow-lg shadow-cyan-500/25 hover:-translate-y-0.5 hover:shadow-cyan-500/35 active:translate-y-0`
    : `${baseClass} bg-cyan-300 text-slate-950 shadow-md shadow-cyan-500/15 hover:bg-cyan-200`;

  if (!card.isPaid) {
    return isSignedIn ? (
      <Link to="/workspaces" className={`${baseClass} border border-slate-700 text-slate-200 hover:bg-slate-800`}>
        Go to Workspaces
      </Link>
    ) : (
      <Link to="/sign-in" className={`${baseClass} border border-slate-700 text-slate-200 hover:bg-slate-800`}>
        Start free
      </Link>
    );
  }

  if (!isSignedIn) {
    return (
      <Link to="/sign-in?redirect=/pricing" className={primaryClass}>
        Get {card.plan}
      </Link>
    );
  }

  if (isCurrent) {
    return (
      <span
        className={`${baseClass} cursor-default border border-emerald-800/50 bg-emerald-950/30 text-emerald-300`}
        aria-label={`${card.plan} is your current plan`}
      >
        <Check className="mr-1.5 h-4 w-4" />
        Your current plan
      </span>
    );
  }

  return (
    <button type="button" onClick={() => onSelectPaid(card.plan as PaidPlan)} className={primaryClass}>
      Get {card.plan}
    </button>
  );
}
