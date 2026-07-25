import React, { useEffect, useRef } from 'react';
import { LivingKnowledgeCanvas } from './LivingKnowledgeCanvas';
import { ShieldCheck, Zap, Users, Sparkles, FileText, Globe, Video, MessageCircle, Lightbulb, Compass } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function LivingKnowledgeSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardsRef.current ? cardsRef.current.children : [],
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top 85%',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0b0f17] border-t border-slate-800/60 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-teal-400 text-xs font-mono uppercase tracking-wider">
            <span>Living Knowledge System</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Dynamic Knowledge Orchestration
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Watch Lumora continuously synthesize raw information streams into structured, queryable contextual intelligence.
          </p>
        </div>

        {/* Center Canvas Showcase Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#121824]/60 border border-slate-800/80 rounded-2xl p-6 sm:p-10 backdrop-blur-sm relative shadow-2xl">
          {/* Left Column: Input Stream Labels */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400 font-mono">
              Input Knowledge Sources
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-[#182030] border border-slate-800 rounded-xl flex items-center space-x-3 text-xs text-slate-200">
                <FileText className="w-4 h-4 text-red-400" />
                <div>
                  <p className="font-semibold">PDF Documents</p>
                  <p className="text-[10px] text-slate-400">OCR & Table Parsing</p>
                </div>
              </div>
              <div className="p-3 bg-[#182030] border border-slate-800 rounded-xl flex items-center space-x-3 text-xs text-slate-200">
                <Globe className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="font-semibold">Websites & Docs</p>
                  <p className="text-[10px] text-slate-400">Live DOM Crawler</p>
                </div>
              </div>
              <div className="p-3 bg-[#182030] border border-slate-800 rounded-xl flex items-center space-x-3 text-xs text-slate-200">
                <Video className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="font-semibold">YouTube & VTT</p>
                  <p className="text-[10px] text-slate-400">Transcript Chunking</p>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Animated Lumora Three.js Core */}
          <div className="lg:col-span-6 w-full h-[320px] sm:h-[400px]">
            <LivingKnowledgeCanvas />
          </div>

          {/* Right Column: Output Stream Labels */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-mono">
              Output Intelligence
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-[#182030] border border-slate-800 rounded-xl flex items-center space-x-3 text-xs text-slate-200">
                <MessageCircle className="w-4 h-4 text-sky-400" />
                <div>
                  <p className="font-semibold">Grounded Answers</p>
                  <p className="text-[10px] text-slate-400">Zero Hallucinations</p>
                </div>
              </div>
              <div className="p-3 bg-[#182030] border border-slate-800 rounded-xl flex items-center space-x-3 text-xs text-slate-200">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="font-semibold">Exact Source Citations</p>
                  <p className="text-[10px] text-slate-400">Direct Chunk References</p>
                </div>
              </div>
              <div className="p-3 bg-[#182030] border border-slate-800 rounded-xl flex items-center space-x-3 text-xs text-slate-200">
                <Compass className="w-4 h-4 text-teal-400" />
                <div>
                  <p className="font-semibold">Synthesized Artifacts</p>
                  <p className="text-[10px] text-slate-400">Roadmaps & Summaries</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Four Production Pillar Cards */}
        <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          <div className="p-6 bg-[#121824] border border-slate-800 hover:border-sky-500/50 rounded-2xl space-y-3 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
              Private & Secure
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strict database and API workspace level isolation ensures your sources and queries remain 100% confidential.
            </p>
          </div>

          <div className="p-6 bg-[#121824] border border-slate-800 hover:border-teal-500/50 rounded-2xl space-y-3 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-teal-950/80 border border-teal-800/60 flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
              Lightning Fast
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Optimized pgvector indexing and streaming RAG delivery deliver sub-second vector search responses.
            </p>
          </div>

          <div className="p-6 bg-[#121824] border border-slate-800 hover:border-indigo-500/50 rounded-2xl space-y-3 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
              Built For Everyone
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Engineered for researchers, developers, students, and product teams handling high-volume knowledge.
            </p>
          </div>

          <div className="p-6 bg-[#121824] border border-slate-800 hover:border-amber-500/50 rounded-2xl space-y-3 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
              Limitless Potential
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Seamlessly scale your workspaces across thousands of sources without losing retrieval precision.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
