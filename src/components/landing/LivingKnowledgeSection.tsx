import React, { useEffect, useRef } from 'react';
import { LivingKnowledgeCanvas } from './LivingKnowledgeCanvas';
import { ShieldCheck, Zap, Users, Sparkles, FileText, Globe, Video, MessageCircle, Lightbulb, Compass } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function LivingKnowledgeSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 72%',
          once: true,
        },
      });
      timeline
        .fromTo(
          headingRef.current,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
        )
        .fromTo(
          diagramRef.current?.querySelectorAll('.living-input') || [],
          { opacity: 0, x: -24 },
          { opacity: 1, x: 0, stagger: 0.13, duration: 0.55 },
          '-=0.2',
        )
        .fromTo(
          diagramRef.current?.querySelector('.living-core'),
          { opacity: 0, scale: 0.9, filter: 'blur(6px)' },
          {
            opacity: 1,
            scale: 1,
            filter: 'blur(0px)',
            duration: 0.9,
            ease: 'power3.out',
          },
          '-=0.38',
        )
        .fromTo(
          diagramRef.current?.querySelectorAll('.living-output') || [],
          { opacity: 0, x: 24 },
          {
            opacity: 1,
            x: 0,
            stagger: 0.13,
            duration: 0.55,
            ease: 'power2.out',
          },
          '-=0.35',
        );

      gsap.fromTo(
        cardsRef.current ? cardsRef.current.children : [],
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          duration: 0.75,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top 88%',
            once: true,
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="landing-section relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        {/* Section Header */}
        <div ref={headingRef} className="mx-auto max-w-3xl space-y-3 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-teal-400 text-xs font-mono uppercase tracking-wider">
            <span>Living Knowledge System</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Dynamic Knowledge Orchestration
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Bring your sources together and turn them into grounded answers you can trace back to the original material.
          </p>
        </div>

        {/* Center Canvas Showcase Layout */}
        <div ref={diagramRef} className="living-diagram relative grid grid-cols-1 items-center gap-8 overflow-hidden rounded-2xl border border-sky-900/25 bg-[#0b1320]/60 p-6 backdrop-blur-sm sm:p-10 lg:grid-cols-12">
          <div aria-hidden="true" className="living-diagram-atmosphere">
            {Array.from({ length: 12 }, (_, index) => (
              <span
                key={index}
                style={{
                  '--star-index': index,
                  '--star-x': `${4 + index * 8.1}%`,
                  '--star-y': `${7 + ((index * 31) % 86)}%`,
                  '--star-size': `${1 + (index % 2)}px`,
                  '--star-opacity': 0.2 + (index % 4) * 0.1,
                  '--star-duration': `${8 + (index % 5) * 1.4}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
          {/* Left Column: Input Stream Labels */}
          <div className="relative z-10 lg:col-span-3 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400 font-mono">
              Input Knowledge Sources
            </h3>
            <div className="space-y-3">
              <div className="living-input group/input flex items-center space-x-3 rounded-xl border border-slate-800 bg-[#182030] p-3 text-xs text-slate-200 transition duration-300 hover:border-sky-500/50 hover:bg-slate-800">
                <FileText className="w-4 h-4 text-red-400" />
                <div>
                  <p className="font-semibold">PDF Documents</p>
                  <p className="text-[10px] text-slate-400">Readable document import</p>
                </div>
              </div>
              <div className="living-input group/input flex items-center space-x-3 rounded-xl border border-slate-800 bg-[#182030] p-3 text-xs text-slate-200 transition duration-300 hover:border-sky-500/50 hover:bg-slate-800">
                <Globe className="h-4 w-4 text-cyan-300" />
                <div>
                  <p className="font-semibold">Websites & Docs</p>
                  <p className="text-[10px] text-slate-400">Articles and documentation</p>
                </div>
              </div>
              <div className="living-input group/input flex items-center space-x-3 rounded-xl border border-slate-800 bg-[#182030] p-3 text-xs text-slate-200 transition duration-300 hover:border-sky-500/50 hover:bg-slate-800">
                <Video className="h-4 w-4 text-cyan-300" />
                <div>
                  <p className="font-semibold">YouTube Videos</p>
                  <p className="text-[10px] text-slate-400">Video transcripts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Animated Lumora Three.js Core */}
          <div className="living-core relative z-10 h-[320px] w-full sm:h-[400px] lg:col-span-6">
            <LivingKnowledgeCanvas />
          </div>

          {/* Right Column: Output Stream Labels */}
          <div className="relative z-10 lg:col-span-3 space-y-4">
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-blue-300">
              Output Intelligence
            </h3>
            <div className="space-y-3">
              <div className="living-output flex items-center space-x-3 rounded-xl border border-slate-800 bg-[#182030] p-3 text-xs text-slate-200">
                <MessageCircle className="w-4 h-4 text-sky-400" />
                <div>
                  <p className="font-semibold">Grounded Answers</p>
                  <p className="text-[10px] text-slate-400">Answers grounded in your sources</p>
                </div>
              </div>
              <div className="living-output flex items-center space-x-3 rounded-xl border border-slate-800 bg-[#182030] p-3 text-xs text-slate-200">
                <Lightbulb className="h-4 w-4 text-cyan-300" />
                <div>
                  <p className="font-semibold">Exact Source Citations</p>
                  <p className="text-[10px] text-slate-400">Direct Chunk References</p>
                </div>
              </div>
              <div className="living-output flex items-center space-x-3 rounded-xl border border-slate-800 bg-[#182030] p-3 text-xs text-slate-200">
                <Compass className="w-4 h-4 text-teal-400" />
                <div>
                  <p className="font-semibold">Multi-source Understanding</p>
                  <p className="text-[10px] text-slate-400">Connected insights across sources</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Four Production Pillar Cards */}
        <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          <div className="landing-card group space-y-3 rounded-2xl border border-slate-800 bg-[#101826]/95 p-6">
            <div className="landing-icon flex h-10 w-10 items-center justify-center rounded-xl border border-sky-800/60 bg-sky-950/80 text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
              Private & Secure
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Workspace-level isolation keeps each Workspace's sources and conversations separate.
            </p>
          </div>

          <div className="landing-card group space-y-3 rounded-2xl border border-slate-800 bg-[#101826]/95 p-6">
            <div className="landing-icon flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-800/60 bg-cyan-950/70 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
              Lightning Fast
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Streaming responses help you stay in the flow while Lumora works through your question.
            </p>
          </div>

          <div className="landing-card group space-y-3 rounded-2xl border border-slate-800 bg-[#101826]/95 p-6">
            <div className="landing-icon flex h-10 w-10 items-center justify-center rounded-xl border border-blue-800/60 bg-blue-950/70 text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white transition-colors group-hover:text-blue-300">
              Built For Everyone
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Designed for students, researchers, and teams learning from complex source material.
            </p>
          </div>

          <div className="landing-card group space-y-3 rounded-2xl border border-slate-800 bg-[#101826]/95 p-6">
            <div className="landing-icon flex h-10 w-10 items-center justify-center rounded-xl border border-sky-800/60 bg-sky-950/80 text-sky-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white transition-colors group-hover:text-sky-300">
              Grounded by Design
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Follow citations back to the source material behind each supported answer.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
