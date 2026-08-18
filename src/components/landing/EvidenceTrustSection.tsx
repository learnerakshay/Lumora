import React, { useEffect, useRef } from 'react';
import { CheckCircle2, HelpCircle, Search, ShieldCheck, Sparkles, Target } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const CHAIN_STEPS = [
  {
    key: 'question',
    label: 'Question',
    icon: HelpCircle,
    detail: '"What is the strongest finding across my sources?"',
  },
  {
    key: 'claim',
    label: 'Claim',
    icon: Target,
    detail: 'Lumora identifies what a grounded answer would need to assert.',
  },
  {
    key: 'evidence',
    label: 'Evidence',
    icon: Search,
    detail: 'Retrieval searches your Workspace for passages that could support it.',
  },
  {
    key: 'verdict',
    label: 'Verdict',
    icon: ShieldCheck,
    detail: 'Lumora decides whether the evidence actually covers the claim — not just whether chunks came back.',
  },
] as const;

// Evidence & Trust — Lumora's real differentiator, not a restatement of the
// hero. The hero shows sources feeding a knowledge core; this section shows
// the judgment call that happens after retrieval: Question -> Claim ->
// Evidence -> Verdict, then a GROUNDED vs GENERAL fork so the visitor can
// see the distinction the product rule ("retrieval finds candidate
// evidence, Lumora decides whether it's enough") actually makes visible.
export function EvidenceTrustSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const outcomesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 72%', once: true },
      });
      timeline
        .fromTo(headingRef.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.36, ease: 'power3.out' })
        .fromTo(
          chainRef.current ? chainRef.current.querySelectorAll('.evidence-node') : [],
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, stagger: 0.12, duration: 0.34, ease: 'power3.out' },
          '-=0.16',
        )
        .fromTo(
          outcomesRef.current,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' },
          '-=0.1',
        )
        // Once the reveal finishes, hand off to the always-on ambient
        // cycle below (pure CSS, no further JS driving it).
        .call(() => chainRef.current?.classList.add('is-cycling'))
        .call(() => outcomesRef.current?.classList.add('is-cycling'));
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="landing-section relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[560px] w-[560px] rounded-full bg-teal-950/18 blur-[130px] pointer-events-none" />

      <div className="mx-auto max-w-6xl space-y-14 relative z-10">
        <div ref={headingRef} className="mx-auto max-w-3xl space-y-3 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-teal-300">
            <span>Evidence &amp; Trust</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Answers are easy.
            <br className="hidden sm:block" /> Trust is the product.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Retrieval finds candidate evidence. Lumora decides whether that evidence is actually enough before it
            calls an answer grounded — and says so plainly when it isn&apos;t.
          </p>
        </div>

        {/* Question -> Claim -> Evidence -> Verdict */}
        <div ref={chainRef} className="evidence-chain relative">
          <div
            aria-hidden="true"
            className="evidence-highway absolute left-[6%] right-[6%] top-[38px] hidden h-[2px] lg:block"
          >
            <span className="evidence-highway-track" />
            <span className="evidence-flow-dot" style={{ '--flow-delay': '0s' } as React.CSSProperties} />
            <span className="evidence-flow-dot" style={{ '--flow-delay': '-2.4s' } as React.CSSProperties} />
          </div>
          <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHAIN_STEPS.map((step, index) => (
              <div
                key={step.key}
                data-step={index}
                className="evidence-node relative rounded-2xl border border-slate-800/55 bg-[#101826]/90 p-5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-800/50 bg-teal-950/30 text-teal-300">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{step.label}</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* GROUNDED vs GENERAL — the fork the verdict actually produces */}
        <div ref={outcomesRef} className="evidence-outcomes grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div
            data-outcome="grounded"
            className="evidence-outcome rounded-2xl border border-emerald-800/35 bg-[#0d1a16]/80 p-6"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Grounded
            </span>
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              Retrieved evidence covers the question, so Lumora answers from your Workspace — every claim traces
              back to a citation.
            </p>
            <div className="mt-4 space-y-2">
              <div
                className="evidence-citation-row flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300"
                style={{ '--row-delay': '0s' } as React.CSSProperties}
              >
                <span>Research.pdf</span>
                <span className="text-emerald-300">Page 3</span>
              </div>
              <div
                className="evidence-citation-row flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300"
                style={{ '--row-delay': '0.9s' } as React.CSSProperties}
              >
                <span>docs.ai/specs</span>
                <span className="text-emerald-300">Section 2</span>
              </div>
            </div>
          </div>

          <div
            data-outcome="general"
            className="evidence-outcome rounded-2xl border border-slate-800/55 bg-[#101826]/80 p-6"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
              <Sparkles className="h-3 w-3" />
              General
            </span>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              When Workspace evidence doesn&apos;t cover the question, Lumora answers from general knowledge
              instead — plainly, with no citations and nothing invented.
            </p>
            <div className="mt-4 rounded-lg border border-slate-800/70 bg-slate-900/50 px-3 py-2.5 text-[11px] text-slate-500">
              No matching Workspace evidence — answered from general knowledge.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
