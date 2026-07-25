import React, { useEffect, useRef } from 'react';
import { FileText, Globe, Video, FileCode, MessageSquare, Cpu, Sparkles, MessageCircle, Lightbulb, Compass, Network, BookOpen, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        flowRef.current ? flowRef.current.children : [],
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.2,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0b0f17] border-t border-slate-800/60 relative overflow-hidden"
    >
      {/* Background Radial Ambient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-950/20 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        {/* Section Heading */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-sky-400 text-xs font-mono uppercase tracking-wider">
            <span>Workflow Arc</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            How Lumora Works
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            From fragmented raw sources to distilled, high-fidelity knowledge in three effortless steps.
          </p>
        </div>

        {/* 3-Step Interactive Visual Flow */}
        <div ref={flowRef} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* STEP 1: COLLECT */}
          <div className="bg-[#121824] border border-slate-800/90 hover:border-sky-500/40 p-6 rounded-2xl flex flex-col justify-between space-y-6 shadow-xl transition-all group">
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

              {/* Input Sources Stack */}
              <div className="space-y-2 pt-2">
                <div className="p-2.5 bg-[#182030] rounded-lg border border-slate-800 flex items-center space-x-3 text-xs text-slate-200">
                  <FileText className="w-4 h-4 text-red-400" />
                  <span>PDF Research & Papers</span>
                </div>
                <div className="p-2.5 bg-[#182030] rounded-lg border border-slate-800 flex items-center space-x-3 text-xs text-slate-200">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>Web Pages & Documentation</span>
                </div>
                <div className="p-2.5 bg-[#182030] rounded-lg border border-slate-800 flex items-center space-x-3 text-xs text-slate-200">
                  <Video className="w-4 h-4 text-amber-400" />
                  <span>YouTube Transcripts & VTT</span>
                </div>
                <div className="p-2.5 bg-[#182030] rounded-lg border border-slate-800 flex items-center space-x-3 text-xs text-slate-200">
                  <FileCode className="w-4 h-4 text-sky-400" />
                  <span>Markdown & Plain Text Notes</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Automatic parsing & text extraction</span>
              <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
            </div>
          </div>

          {/* STEP 2: UNDERSTAND (Lumora Core) */}
          <div className="bg-[#121824] border border-sky-500/40 p-6 rounded-2xl flex flex-col justify-between space-y-6 shadow-xl shadow-sky-950/20 relative group">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-sky-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider">
              Core Processing
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 font-mono tracking-widest uppercase">
                  STEP 02
                </span>
                <span className="px-2.5 py-1 rounded-full bg-teal-950/80 text-teal-300 text-[10px] font-semibold border border-teal-800/50">
                  pgvector + RAG
                </span>
              </div>

              <h3 className="text-xl font-bold text-white group-hover:text-teal-300 transition-colors">
                Understand
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Lumora chunks, embeds into 1536-dim vector space, and establishes contextual relationships.
              </p>

              {/* Lumora Core Visual Badge Box */}
              <div className="my-4 p-5 bg-gradient-to-b from-[#182030] to-[#0d131f] border border-sky-500/30 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-400/40 flex items-center justify-center text-sky-400 animate-pulse">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Lumora Vector Core</h4>
                  <p className="text-[10px] text-slate-400 font-mono">1536-dim Vector Embeddings</p>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-2/3 h-full bg-gradient-to-r from-sky-400 to-teal-400 rounded-full animate-pulse" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Hybrid Vector & Keyword Indexing</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
            </div>
          </div>

          {/* STEP 3: TRANSFORM */}
          <div className="bg-[#121824] border border-slate-800/90 hover:border-indigo-500/40 p-6 rounded-2xl flex flex-col justify-between space-y-6 shadow-xl transition-all group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 font-mono tracking-widest uppercase">
                  STEP 03
                </span>
                <span className="px-2.5 py-1 rounded-full bg-indigo-950/80 text-indigo-300 text-[10px] font-semibold border border-indigo-800/50">
                  Synthesis
                </span>
              </div>

              <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                Transform
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Synthesize insights, ask complex queries with exact citations, and generate actionable artifacts.
              </p>

              {/* Output Capabilities Stack */}
              <div className="space-y-2 pt-2">
                <div className="p-2.5 bg-[#182030] rounded-lg border border-slate-800 flex items-center space-x-3 text-xs text-slate-200">
                  <MessageCircle className="w-4 h-4 text-sky-400" />
                  <span>Interactive AI Workspace Chat</span>
                </div>
                <div className="p-2.5 bg-[#182030] rounded-lg border border-slate-800 flex items-center space-x-3 text-xs text-slate-200">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>Cited Source Insights & Summaries</span>
                </div>
                <div className="p-2.5 bg-[#182030] rounded-lg border border-slate-800 flex items-center space-x-3 text-xs text-slate-200">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  <span>Structured Learning Roadmaps</span>
                </div>
                <div className="p-2.5 bg-[#182030] rounded-lg border border-slate-800 flex items-center space-x-3 text-xs text-slate-200">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>Comprehensive Study Guides</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Grounded in your exact sources</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
