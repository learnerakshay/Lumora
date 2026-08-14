import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LANDING_FEATURES } from './landing-content';
import { FileCode, FileText, Globe, Video } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', once: true } });
      timeline
        .fromTo(headingRef.current, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.36, ease: 'power3.out' })
        .fromTo(gridRef.current ? gridRef.current.children : [], { opacity: 0, y: 18 }, { opacity: 1, y: 0, stagger: 0.055, duration: 0.34, ease: 'power2.out' }, '-=0.16');
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="landing-section relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-16">
        <div ref={headingRef} className="mx-auto max-w-3xl space-y-3 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-sky-400">
            <span>Learning Essentials</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">Everything you need to learn from your sources</h2>
          <p className="text-sm text-slate-400 sm:text-base">Collect useful material, ask better questions, and keep the supporting sources close at hand.</p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature) => {
            const Icon = feature.icon;
            const isHero = feature.variant === 'hero';
            return (
              <article
                key={feature.id}
                data-feature={feature.id}
                className={`landing-card group flex flex-col rounded-2xl border bg-[#101826]/95 p-6 shadow-lg ${isHero ? 'landing-feature-hero min-h-60 border-sky-900/65 sm:col-span-2 lg:col-span-1' : 'min-h-48 border-slate-800/90'} ${feature.id === 'chat' ? 'lg:col-span-2' : ''}`}
              >
                <div className="landing-icon flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-sky-400 group-hover:bg-sky-950/40">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="relative z-10 mt-4 space-y-1.5">
                  <h3 className="text-base font-bold text-white transition-colors group-hover:text-sky-300">{feature.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{feature.description}</p>
                </div>

                {feature.id === 'chat' && (
                  <div className="relative z-10 mt-auto grid gap-2 pt-5 sm:grid-cols-[0.8fr_1.2fr]" aria-hidden="true">
                    <div className="rounded-xl border border-sky-900/70 bg-slate-950/65 px-3 py-2.5 text-[10px] leading-4 text-slate-300">
                      What is the strongest finding across my sources?
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-[10px] leading-4 text-slate-300">
                      The evidence converges on one key insight.
                      <span className="mt-2 flex items-center gap-1.5 text-[9px] text-sky-300">
                        <span className="rounded border border-sky-900/80 px-1.5 py-0.5">Research.pdf</span>
                        <span className="text-slate-500">Page 3</span>
                      </span>
                    </div>
                  </div>
                )}

                {feature.id === 'citations' && (
                  <div className="relative z-10 mt-auto space-y-2 pt-5" aria-hidden="true">
                    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/75 px-3 py-2 text-[10px] text-slate-300">
                      <span>Research.pdf</span><span className="text-sky-300">Page 3</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/75 px-3 py-2 text-[10px] text-slate-300">
                      <span>docs.ai/specs</span><span className="text-cyan-300">Section 2</span>
                    </div>
                  </div>
                )}

                {feature.id === 'ingestion' && (
                  <div className="relative z-10 mt-auto flex items-center gap-2 pt-5" aria-label="Supported sources: PDF, websites, YouTube, and plain text">
                    <span className="landing-source-token border-rose-900/70 bg-rose-950/50 text-rose-300"><FileText /></span>
                    <span className="landing-source-token border-cyan-900/70 bg-cyan-950/50 text-cyan-300"><Globe /></span>
                    <span className="landing-source-token border-red-900/70 bg-red-950/50 text-red-300"><Video /></span>
                    <span className="landing-source-token border-violet-900/70 bg-violet-950/50 text-violet-300"><FileCode /></span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
