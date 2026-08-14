import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LANDING_FEATURES } from './landing-content';

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
            return (
              <div key={feature.title} className="landing-card group flex min-h-48 flex-col rounded-2xl border border-slate-800/90 bg-[#101826]/95 p-6 shadow-lg">
                <div className="landing-icon flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-sky-400 group-hover:bg-sky-950/40">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="relative z-10 mt-4 space-y-1.5">
                  <h3 className="text-base font-bold text-white transition-colors group-hover:text-sky-300">{feature.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
