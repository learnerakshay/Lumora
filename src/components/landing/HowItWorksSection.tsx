import React, { useEffect, useRef } from 'react';
import { FileText, Globe, Video, FileCode, Cpu, Sparkles, MessageCircle, Lightbulb, Bookmark, Layers3, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { attachSpotlight } from './motion/spotlight';

gsap.registerPlugin(ScrollTrigger);

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<HTMLDivElement>(null);
  const collectRef = useRef<HTMLDivElement>(null);
  const understandRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanups = [collectRef, understandRef, transformRef].map((ref) =>
      ref.current ? attachSpotlight(ref.current, 'cyan') : () => {},
    );
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 76%',
          once: true,
        },
      });
      timeline
        .fromTo(
          headingRef.current,
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.36, ease: 'power3.out' },
        )
        .fromTo(
          flowRef.current ? flowRef.current.children : [],
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.08,
            duration: 0.38,
            ease: 'power3.out',
          },
          '-=0.35',
        )
        .fromTo(
          connectorRef.current,
          { scaleX: 0, opacity: 0 },
          {
            scaleX: 1,
            opacity: 1,
            transformOrigin: 'left center',
            duration: 0.5,
            ease: 'power2.inOut',
          },
          '-=1.05',
        )
        // Collect -> Understand -> Transform activate in sequence, once,
        // as the pipeline scrolls into view (scroll-storytelling tier).
        // Each stage's own ambient CSS keeps running afterward.
        .call(() => collectRef.current?.classList.add('is-live'), [], '-=0.15')
        .call(() => understandRef.current?.classList.add('is-live'), [], '+=0.3')
        .call(() => transformRef.current?.classList.add('is-live'), [], '+=0.3');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="landing-section relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8"
    >
      {/* Background Radial Ambient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-950/20 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-14 relative z-10">
        {/* Section Heading */}
        <div ref={headingRef} className="mx-auto max-w-3xl space-y-3 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-sky-400 text-xs font-mono uppercase tracking-wider">
            <span>Workflow Arc</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            How Lumora Works
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Bring in useful material, let Lumora prepare it, and explore it through grounded conversation.
          </p>
        </div>

        {/* 3-Step Interactive Visual Flow */}
        <div className="workflow-pipeline relative">
          <div
            ref={connectorRef}
            aria-hidden="true"
            className="workflow-highway absolute left-[16%] right-[16%] top-1/2 hidden h-[3px] lg:block"
          >
            <span className="workflow-highway-track" />
            <span className="workflow-packet" style={{ '--packet-delay': '0s' } as React.CSSProperties} />
            <span className="workflow-packet" style={{ '--packet-delay': '-1.6s' } as React.CSSProperties} />
            <span className="workflow-packet" style={{ '--packet-delay': '-3.2s' } as React.CSSProperties} />
          </div>
        <div ref={flowRef} className="relative grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
          {/* STEP 1: COLLECT */}
          <div ref={collectRef} data-stage="collect" className="landing-card workflow-card-soft group flex flex-col justify-between space-y-6 rounded-2xl border border-slate-800/55 bg-[#101826]/90 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 font-mono tracking-widest uppercase">
                  STEP 01
                </span>
                <span className="px-2.5 py-1 rounded-full bg-sky-950/80 text-sky-300 text-[10px] font-semibold border border-sky-800/50">
                  Ingestion
                </span>
              </div>

              <h3 className="text-xl font-bold text-white group-hover:text-sky-300 transition-colors">
                Collect
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect and ingest multi-format knowledge items directly into your isolated workspace.
              </p>

              {/* Input Sources Stack — each row periodically emits a small
                  particle toward the connector, illustrating material
                  entering the pipeline. */}
              <div className="space-y-2 pt-2">
                <div className="workflow-item workflow-emitter relative flex items-center space-x-3 rounded-lg border border-slate-800 bg-[#182030] p-2.5 text-xs text-slate-200" style={{ '--emit-delay': '0s' } as React.CSSProperties}>
                  <FileText className="w-4 h-4 text-red-400" />
                  <span>PDF Research & Papers</span>
                  <span className="workflow-emit-particle" aria-hidden="true" />
                </div>
                <div className="workflow-item workflow-emitter relative flex items-center space-x-3 rounded-lg border border-slate-800 bg-[#182030] p-2.5 text-xs text-slate-200" style={{ '--emit-delay': '-1.1s' } as React.CSSProperties}>
                  <Globe className="h-4 w-4 text-cyan-300" />
                  <span>Web Pages & Documentation</span>
                  <span className="workflow-emit-particle" aria-hidden="true" />
                </div>
                <div className="workflow-item workflow-emitter relative flex items-center space-x-3 rounded-lg border border-slate-800 bg-[#182030] p-2.5 text-xs text-slate-200" style={{ '--emit-delay': '-2.2s' } as React.CSSProperties}>
                  <Video className="h-4 w-4 text-cyan-300" />
                  <span>YouTube Videos</span>
                  <span className="workflow-emit-particle" aria-hidden="true" />
                </div>
                <div className="workflow-item workflow-emitter relative flex items-center space-x-3 rounded-lg border border-slate-800 bg-[#182030] p-2.5 text-xs text-slate-200" style={{ '--emit-delay': '-3.3s' } as React.CSSProperties}>
                  <FileCode className="w-4 h-4 text-sky-400" />
                  <span>Markdown & Plain Text Notes</span>
                  <span className="workflow-emit-particle" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Automatic parsing & text extraction</span>
              <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
            </div>
          </div>

          {/* STEP 2: UNDERSTAND */}
          <div ref={understandRef} data-stage="understand" className="landing-card workflow-card-soft group relative flex flex-col justify-between space-y-6 rounded-2xl border border-sky-500/30 bg-[#101826]/90 p-6 shadow-sky-950/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 font-mono tracking-widest uppercase">
                  STEP 02
                </span>
                <span className="px-2.5 py-1 rounded-full bg-teal-950/80 text-teal-300 text-[10px] font-semibold border border-teal-800/50">
                  Source preparation
                </span>
              </div>

              <h3 className="text-xl font-bold text-white group-hover:text-teal-300 transition-colors">
                Understand
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Lumora prepares and indexes your material so it can find the most relevant context for each question.
              </p>

              {/* Knowledge preparation visual */}
              <div className="my-4 p-5 bg-gradient-to-b from-[#182030] to-[#0d131f] border border-sky-500/25 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                <div className="landing-icon workflow-core-icon relative flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400/40 bg-sky-500/10 text-sky-400">
                  <Cpu className="w-6 h-6" />
                  <span className="workflow-orbit" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Lumora Knowledge Core</h4>
                  <p className="text-[10px] text-slate-400">Your sources, prepared for learning</p>
                </div>
                <div className="landing-signal w-full" />
                <div className="workflow-progress-track h-1 w-full overflow-hidden rounded-full bg-slate-800/70" aria-hidden="true">
                  <div className="workflow-progress-fill h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-300" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Relevant context ready for each question</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
            </div>
          </div>

          {/* STEP 3: TRANSFORM */}
          <div ref={transformRef} data-stage="transform" className="landing-card workflow-card-soft group flex flex-col justify-between space-y-6 rounded-2xl border border-slate-800/55 bg-[#101826]/90 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-blue-300">
                  STEP 03
                </span>
                <span className="rounded-full border border-blue-800/50 bg-blue-950/80 px-2.5 py-1 text-[10px] font-semibold text-blue-300">
                  Synthesis
                </span>
              </div>

              <h3 className="text-xl font-bold text-white transition-colors group-hover:text-blue-300">
                Transform
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ask questions, connect ideas across sources, and follow citations back to the supporting material.
              </p>

              {/* Output Capabilities Stack */}
              <div className="space-y-2 pt-2">
                <div className="workflow-item flex items-center space-x-3 rounded-lg border border-slate-800 bg-[#182030] p-2.5 text-xs text-slate-200">
                  <MessageCircle className="w-4 h-4 text-sky-400" />
                  <span>Interactive AI Workspace Chat</span>
                  <span className="ml-auto flex items-center gap-0.5" aria-hidden="true">
                    <span className="landing-typing-dot h-1 w-1 rounded-full bg-sky-400" style={{ animationDelay: '0ms' }} />
                    <span className="landing-typing-dot h-1 w-1 rounded-full bg-sky-400" style={{ animationDelay: '140ms' }} />
                    <span className="landing-typing-dot h-1 w-1 rounded-full bg-sky-400" style={{ animationDelay: '280ms' }} />
                  </span>
                </div>
                <div className="workflow-item flex items-center space-x-3 rounded-lg border border-slate-800 bg-[#182030] p-2.5 text-xs text-slate-200">
                  <Lightbulb className="h-4 w-4 text-cyan-300" />
                  <span>Cited Source Insights & Summaries</span>
                </div>
                <div className="workflow-item workflow-citation-glow flex items-center space-x-3 rounded-lg border border-slate-800 bg-[#182030] p-2.5 text-xs text-slate-200">
                  <Bookmark className="h-4 w-4 text-violet-300" />
                  <span>Clear Source Citations</span>
                </div>
                <div className="workflow-item flex items-center space-x-3 rounded-lg border border-slate-800 bg-[#182030] p-2.5 text-xs text-slate-200">
                  <Layers3 className="h-4 w-4 text-blue-300" />
                  <span>Multi-source Understanding</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Grounded in your exact sources</span>
              <Sparkles className="h-3.5 w-3.5 text-blue-300" />
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
