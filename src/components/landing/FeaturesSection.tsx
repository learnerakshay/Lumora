import React, { useEffect, useRef } from 'react';
import { Bookmark, FileCode, FileText, Globe, Layers3, Lock, MessageSquareText, Video, Zap } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  { icon: Lock, title: 'Private Workspaces', description: 'Workspace-level safeguards keep each Workspace and its source material separate.' },
  { icon: MessageSquareText, title: 'Grounded Workspace Chat', description: 'Ask questions in a focused conversation grounded in the sources you have added.' },
  { icon: Layers3, title: 'Multi-source Learning', description: 'Connect insights across PDFs, websites, YouTube videos, and plain text in one Workspace.' },
  { icon: FileText, title: 'PDF Documents', description: 'Import PDF documents and use their content in grounded conversations.' },
  { icon: Globe, title: 'Web Pages', description: 'Bring articles and documentation into the same learning flow as your other sources.' },
  { icon: Video, title: 'YouTube Videos', description: 'Learn from supported YouTube videos through their available transcripts.' },
  { icon: FileCode, title: 'Plain Text', description: 'Add notes and other plain text directly to a Workspace.' },
  { icon: Zap, title: 'Streaming Responses', description: 'Read responses as they arrive instead of waiting for the entire answer.' },
  { icon: Bookmark, title: 'Source Citations', description: 'Trace supported answers back to the source material behind them.' },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', once: true } });
      timeline
        .fromTo(headingRef.current, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' })
        .fromTo(gridRef.current ? gridRef.current.children : [], { opacity: 0, y: 25 }, { opacity: 1, y: 0, stagger: 0.075, duration: 0.58, ease: 'power2.out' }, '-=0.28');
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
          {FEATURES.map((feature, idx) => {
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
                {feature.title === 'Grounded Workspace Chat' ? (
                  <div className="landing-chat-demo relative z-10 mt-auto pt-4" aria-hidden="true">
                    <div className="rounded-lg border border-sky-900/70 bg-slate-950/70 px-2.5 py-2 text-[9px] text-slate-300">Summarize the strongest finding</div>
                    <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2">
                      <div className="flex min-w-0 items-center gap-2 text-[9px] text-slate-300"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" /><span className="min-w-0 flex-1 overflow-hidden text-left"><span className="landing-stream-copy">The evidence converges on one key insight.</span><span className="landing-stream-cursor" /></span></div>
                      <div className="mt-2 flex items-center gap-1.5"><span className="rounded border border-sky-900 px-1.5 py-0.5 text-[8px] text-sky-300">Research.pdf</span><span className="rounded border border-slate-700 px-1.5 py-0.5 text-[8px] text-slate-400">Page 3</span></div>
                    </div>
                  </div>
                ) : <div className="landing-signal relative z-10 mt-auto" style={{ '--signal-delay': `${idx * -0.18}s` } as React.CSSProperties} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
