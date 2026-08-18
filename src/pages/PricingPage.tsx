import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useAccess } from '../components/payments/AccessProvider';
import { CheckoutDialog } from '../components/payments/CheckoutDialog';
import { PricingCards } from '../components/pricing/PricingCards';
import { PlanComparisonTable } from '../components/pricing/PlanComparisonTable';
import { Footer } from '../components/landing/Footer';
import { ACCESS_TERMS_LABEL, USAGE_WINDOW_LABEL } from '../lib/payments/pricing-presentation';
import { PLAN_ACCESS_DAYS_DEFAULT } from '../lib/payments/config';
import type { PaidPlan } from '../lib/payments/config';
import '../components/landing/landing-motion.css';

const FAQ_ITEMS: Array<{ question: string; answer: React.ReactNode }> = [
  {
    question: `What does "${PLAN_ACCESS_DAYS_DEFAULT} days access" mean?`,
    answer: `CORE and MAX are one-time purchases, not subscriptions. Paying once unlocks the plan's limits for ${PLAN_ACCESS_DAYS_DEFAULT} days from purchase — there's no recurring charge and nothing renews automatically.`,
  },
  {
    question: 'What happens when my access expires?',
    answer:
      'You automatically drop back to FREE limits (or to a lower plan if you still have unexpired access to it). Your Workspaces, sources, and history are never deleted — only the higher usage capacity ends.',
  },
  {
    question: 'If I renew early, do I lose my remaining days?',
    answer:
      "No. Renewing the same plan before it expires adds the new 30 days on top of your remaining time — you never lose access you've already paid for.",
  },
  {
    question: 'What happens if I upgrade from CORE to MAX?',
    answer:
      'MAX access starts immediately for 30 days. Your remaining CORE days are preserved underneath and resume automatically if your MAX access ends first.',
  },
  {
    question: 'Is this a subscription? Will I be charged again automatically?',
    answer: `No. ${ACCESS_TERMS_LABEL}. There is no auto-renewal, no card stored for future charges, and nothing to cancel.`,
  },
  {
    question: 'What if I need a refund?',
    answer: (
      <>
        Reach out at{' '}
        <Link to="/contact" className="text-cyan-300 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-200">
          our contact page
        </Link>{' '}
        and we'll help directly.
      </>
    ),
  },
];

export function PricingPage() {
  const { isSignedIn } = useAuth();
  const access = useAccess();
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null);

  return (
    <main className="landing-experience relative min-h-screen overflow-x-hidden bg-[#0b0f17] text-[#f0f4f8]">
      <div className="relative z-10 px-4 pb-16 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-11">
          <div className="mx-auto max-w-3xl space-y-3.5 text-center">
            <div className="inline-flex items-center space-x-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-sky-400">
              <span>Pricing</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">Simple, one-time pricing</h1>
            <p className="text-sm text-slate-400 sm:text-base">
              Every meaningful difference between FREE, CORE, and MAX — no guessing. Limits reset {USAGE_WINDOW_LABEL}.
            </p>
          </div>

          <PricingCards currentPlan={isSignedIn ? access.plan : null} onSelectPaid={setCheckoutPlan} />
          <PlanComparisonTable />

          <section aria-labelledby="pricing-faq-title" className="mx-auto max-w-3xl">
            <h2 id="pricing-faq-title" className="text-center text-2xl font-bold tracking-tight text-white">
              Frequently asked questions
            </h2>
            <div className="mt-6 space-y-2.5">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-slate-800/90 bg-[#101826]/95 transition-colors open:border-cyan-400/25 open:bg-cyan-400/[0.03]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180 group-open:text-cyan-300" />
                  </summary>
                  <div className="px-5 pb-5 text-xs leading-relaxed text-slate-400">{item.answer}</div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="landing-closing-surface relative overflow-hidden">
        <Footer />
      </div>

      {checkoutPlan && (
        <CheckoutDialog
          isOpen={Boolean(checkoutPlan)}
          plan={checkoutPlan}
          currentPlan={isSignedIn ? access.plan : null}
          onClose={() => setCheckoutPlan(null)}
        />
      )}
    </main>
  );
}
