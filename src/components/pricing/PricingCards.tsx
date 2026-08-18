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
export function PricingCards({ currentPlan, onSelectPaid }: PricingCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
    <article
      data-plan={card.plan}
      className={`landing-card relative flex flex-col rounded-2xl border p-6 ${
        isPopular
          ? 'border-cyan-400/50 bg-gradient-to-b from-cyan-400/[0.08] to-[#101826]/95 shadow-[0_0_40px_rgba(34,211,238,0.08)]'
          : 'border-slate-800/90 bg-[#101826]/95'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-950 shadow-md shadow-cyan-500/25">
          <Sparkles className="h-3 w-3" />
          Most popular
        </span>
      )}

      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{card.plan}</h3>

      <div className="mt-3 flex items-baseline gap-2">
        {card.listPriceLabel && <span className="text-sm text-slate-500 line-through">{card.listPriceLabel}</span>}
        <span className="text-3xl font-bold tracking-tight text-white">{card.priceLabel}</span>
        {card.isPaid && <span className="text-xs text-slate-500">/ {card.accessDays} days</span>}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        {card.isPaid ? ACCESS_TERMS_LABEL : `Always free · ${USAGE_WINDOW_LABEL}`}
      </p>

      <ul className="mt-5 space-y-2 text-xs text-slate-300">
        {Object.entries(card.limits).map(([action, limit]) => (
          <li key={action} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            <span>
              <strong className="font-mono text-slate-100">{limit}</strong> {actionLabel(action)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <PlanCta card={card} isCurrent={isCurrent} isSignedIn={isSignedIn} onSelectPaid={onSelectPaid} />
      </div>
    </article>
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
  const baseClass =
    'flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition';

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
      <Link
        to="/sign-in?redirect=/pricing"
        className={`${baseClass} bg-cyan-300 text-slate-950 shadow-md shadow-cyan-500/15 hover:bg-cyan-200`}
      >
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
    <button
      type="button"
      onClick={() => onSelectPaid(card.plan as PaidPlan)}
      className={`${baseClass} bg-cyan-300 text-slate-950 shadow-md shadow-cyan-500/15 hover:bg-cyan-200`}
    >
      Get {card.plan}
    </button>
  );
}
