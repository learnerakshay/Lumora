import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, HelpCircle, Search, ShieldCheck, Sparkles, Target } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SpotlightCard } from './motion/SpotlightCard';
import { CitationTag } from './CitationTag';

gsap.registerPlugin(ScrollTrigger);

const AUTOPLAY_INTERVAL_MS = 2600;

type Outcome = 'grounded' | 'general';

const STEP_META = [
  { key: 'question', label: 'Question', icon: HelpCircle },
  { key: 'claim', label: 'Claim', icon: Target },
  { key: 'evidence', label: 'Evidence', icon: Search },
  { key: 'verdict', label: 'Verdict', icon: ShieldCheck },
] as const;

// Two real demonstrations run through the same four steps — this is what
// actually makes the GROUNDED/GENERAL distinction land as a proof rather
// than a claim: the visitor picks a question and watches Lumora's own
// evidence-sufficiency judgment produce a different verdict.
const PATHS: Record<Outcome, string[]> = {
  grounded: [
    '"What is the strongest finding across my sources?"',
    'Lumora identifies what a grounded answer would need to assert.',
    'Retrieval finds Research.pdf (Page 3) and docs.ai/specs (Section 2) directly addressing it.',
    'Evidence covers the claim — Lumora answers from your Workspace, with citations.',
  ],
  general: [
    '"What\'s the capital of France?"',
    'Lumora identifies what a grounded answer would need to assert.',
    'Retrieval finds nothing in your Workspace addressing it.',
    'No Workspace evidence covers the claim — Lumora answers from general knowledge instead.',
  ],
};

// Evidence & Trust — Lumora's real differentiator, not a restatement of the
// hero. A self-playing Question -> Claim -> Evidence -> Verdict demo (one
// of two real example paths, picked via the toggle) proves the product
// rule ("retrieval finds candidate evidence, Lumora decides whether it's
// enough") instead of just stating it.
export function EvidenceTrustSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  const [outcome, setOutcome] = useState<Outcome>('grounded');
  const [activeStep, setActiveStep] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 3 : 0,
  );
  const [autoplay, setAutoplay] = useState(true);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headingRef.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.36, ease: 'power3.out', scrollTrigger: { trigger: sectionRef.current, start: 'top 76%' } },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  // Advance only while the demo is actually visible — never burn frames
  // animating a section nobody is looking at.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!autoplay || !inView || hovered) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => {
      setActiveStep((step) => (step + 1) % STEP_META.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [autoplay, inView, hovered]);

  const jumpToStep = (index: number) => {
    setAutoplay(false);
    setActiveStep(index);
  };

  return (
    <section id="grounding" ref={sectionRef} className="landing-section relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
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

          <div className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/70 p-1 text-[11px]" role="group" aria-label="Choose which example to demonstrate">
            <button
              type="button"
              onClick={() => setOutcome('grounded')}
              aria-pressed={outcome === 'grounded'}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${outcome === 'grounded' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Evidence covers it
            </button>
            <button
              type="button"
              onClick={() => setOutcome('general')}
              aria-pressed={outcome === 'general'}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${outcome === 'general' ? 'bg-slate-700/50 text-slate-200' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Evidence doesn&apos;t
            </button>
          </div>
        </div>

        {/* Question -> Claim -> Evidence -> Verdict — self-playing, pausable */}
        <div
          className="evidence-chain relative"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div aria-hidden="true" className="evidence-highway absolute left-[6%] right-[6%] top-[38px] hidden h-[3px] lg:block">
            <span className="evidence-highway-track" />
            <div
              className="evidence-highway-fill"
              style={{ width: `${((activeStep + 1) / STEP_META.length) * 100}%` }}
            />
          </div>
          <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEP_META.map((step, index) => {
              const isActive = index === activeStep;
              return (
                <SpotlightCard
                  key={step.key}
                  as="article"
                  accent="cyan"
                  data-step={index}
                  className={`evidence-node relative rounded-2xl border p-5 text-left transition-colors ${isActive ? 'is-active border-teal-500/55 bg-[#101826]' : 'border-slate-800/55 bg-[#101826]/70 opacity-55'}`}
                >
                  <button
                    type="button"
                    onClick={() => jumpToStep(index)}
                    className="absolute inset-0 z-10 w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                    aria-label={`Jump to ${step.label}`}
                  />
                  <div className="relative z-0 flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg border text-teal-300 transition-shadow ${isActive ? 'border-teal-500/60 bg-teal-950/50 shadow-[0_0_18px_rgba(45,212,191,0.28)]' : 'border-teal-800/50 bg-teal-950/30'}`}>
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{step.label}</span>
                  </div>
                  <p className="relative z-0 mt-3 text-xs leading-relaxed text-slate-300">{PATHS[outcome][index]}</p>
                </SpotlightCard>
              );
            })}
          </div>
        </div>

        {/* GROUNDED vs GENERAL — tied to the toggle above and to Verdict */}
        <div className="evidence-outcomes grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SpotlightCard
            as="article"
            accent="green"
            data-outcome="grounded"
            className={`evidence-outcome rounded-2xl border p-6 transition-all duration-500 ${outcome === 'grounded' ? 'is-emphasized scale-[1.02] border-emerald-500/55 bg-[#0d1a16]' : 'border-emerald-800/25 bg-[#0d1a16]/60 opacity-50'}`}
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
              <CitationTag
                source="Research.pdf"
                coordinate="Page 3"
                excerpt="Sufficiency of retrieved evidence must be assessed before an answer is treated as grounded, not assumed from the presence of chunks alone."
                score="0.91 match"
                className="evidence-citation-row flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300"
              >
                <span>Research.pdf</span>
                <span className="text-emerald-300">Page 3</span>
              </CitationTag>
              <CitationTag
                source="docs.ai/specs"
                coordinate="Section 2"
                excerpt="Grounding decisions must be judged by evidence sufficiency, not retrieval count alone — chunks alone are never proof of coverage."
                score="0.88 match"
                className="evidence-citation-row flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300"
              >
                <span>docs.ai/specs</span>
                <span className="text-emerald-300">Section 2</span>
              </CitationTag>
            </div>
          </SpotlightCard>

          <SpotlightCard
            as="article"
            accent="cyan"
            data-outcome="general"
            className={`evidence-outcome rounded-2xl border p-6 transition-all duration-500 ${outcome === 'general' ? 'is-emphasized scale-[1.02] border-slate-500/55 bg-[#101826]' : 'border-slate-800/40 bg-[#101826]/60 opacity-50'}`}
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
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
