import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { useAccess } from '../payments/AccessProvider';
import { CheckoutDialog } from '../payments/CheckoutDialog';
import { PricingCards } from './PricingCards';
import { PlanComparisonTable } from './PlanComparisonTable';
import type { PaidPlan } from '../../lib/payments/config';

gsap.registerPlugin(ScrollTrigger);

// Premium pricing surface embedded on the landing page. Shares
// PricingCards / PlanComparisonTable / CheckoutDialog with the standalone
// /pricing page so both surfaces stay identical by construction.
export function PricingSection() {
  const { isSignedIn } = useAuth();
  const access = useAccess();
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', once: true } });
      timeline
        .fromTo(headingRef.current, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.36, ease: 'power3.out' })
        .fromTo(contentRef.current, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.36, ease: 'power3.out' }, '-=0.18');
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="pricing" ref={sectionRef} className="landing-section relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-12">
        <div ref={headingRef} className="mx-auto max-w-3xl space-y-3 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-sky-400">
            <span>Pricing</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">Simple, one-time pricing</h2>
          <p className="text-sm text-slate-400 sm:text-base">
            Every Lumora capability is available on every plan. Paid plans raise how much you can do.
          </p>
        </div>

        <div ref={contentRef} className="space-y-8">
          <PricingCards currentPlan={isSignedIn ? access.plan : null} onSelectPaid={setCheckoutPlan} />
          <PlanComparisonTable />
          <p className="text-center text-xs text-slate-500">
            Want the full picture, FAQs, and a standalone link to share?{' '}
            <Link to="/pricing" className="font-medium text-cyan-300 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-200">
              View the pricing page
            </Link>
            .
          </p>
        </div>
      </div>

      {checkoutPlan && (
        <CheckoutDialog isOpen={Boolean(checkoutPlan)} plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
      )}
    </section>
  );
}
