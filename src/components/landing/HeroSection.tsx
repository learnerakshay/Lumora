import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { HeroCoreCanvas } from './HeroCoreCanvas';
import { FileText, Globe, Video, FileCode, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';

export function HeroSection() {
  const { isSignedIn } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.0 } });

      tl.fromTo(
        headlineRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, delay: 0.1 }
      )
        .fromTo(
          sublineRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1 },
          '-=0.7'
        )
        .fromTo(
          ctaRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1 },
          '-=0.7'
        )
        .fromTo(
          cardsRef.current ? cardsRef.current.children : [],
          { scale: 0.85, opacity: 0, y: 15 },
          { scale: 1, opacity: 1, y: 0, stagger: 0.12, duration: 0.8 },
          '-=0.5'
        );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="overview"
      ref={heroRef}
      className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center overflow-hidden pt-12 pb-20 px-4 sm:px-6 lg:px-8 bg-[#0b0f17]"
    >
      {/* Background Aurora Glows & Horizon Mountains Graphic */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-sky-500/15 via-teal-500/10 to-indigo-500/15 blur-[120px] rounded-full opacity-60" />
        <div className="absolute top-0 right-10 w-[400px] h-[300px] bg-sky-400/10 blur-[100px] rounded-full" />
        
        {/* Subtle Horizon Silhouette */}
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#0b0f17] via-[#0b0f17]/90 to-transparent z-10" />
      </div>

      <div className="relative z-20 max-w-5xl mx-auto text-center space-y-6">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-sky-950/70 border border-sky-800/60 text-sky-300 text-xs font-medium tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Lumora — AI Knowledge Operating System</span>
        </div>

        {/* Main Headline */}
        <h1
          ref={headlineRef}
          className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]"
        >
          Turn scattered knowledge into{' '}
          <span className="bg-gradient-to-r from-sky-300 via-teal-200 to-indigo-300 bg-clip-text text-transparent">
            lasting understanding.
          </span>
        </h1>

        {/* Supporting Copy */}
        <p
          ref={sublineRef}
          className="text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal"
        >
          Consolidate research papers, docs, web pages, media transcripts, and notes into a unified contextual intelligence engine built for high-velocity research.
        </p>

        {/* Primary CTA & Secondary */}
        <div ref={ctaRef} className="pt-2 flex flex-col items-center space-y-3">
          {isSignedIn ? (
            <Link
              to="/workspaces"
              className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-sky-500/25 hover:shadow-sky-400/40 cursor-pointer"
            >
              <span>Go to Workspaces Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/sign-in"
              className="inline-flex items-center space-x-2 px-7 py-3.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-sky-500/25 hover:shadow-sky-400/40 cursor-pointer"
            >
              <span>Try Lumora Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <p className="text-xs text-slate-400 tracking-wide">
            No setup required. Instant workspace initialization.
          </p>
        </div>
      </div>

      {/* Hero Canvas & Floating Source Cards Layout */}
      <div className="relative z-10 w-full max-w-6xl mx-auto mt-6 sm:mt-10">
        {/* Three.js Lumora Core Canvas */}
        <div className="w-full h-[380px] sm:h-[480px] lg:h-[520px]">
          <HeroCoreCanvas />
        </div>

        {/* Floating Source Cards Overlay */}
        <div
          ref={cardsRef}
          className="absolute inset-0 pointer-events-none flex flex-wrap items-center justify-between p-4 sm:p-6"
        >
          {/* Card 1: PDF (Top Left) */}
          <div className="hidden sm:flex absolute top-4 left-2 sm:left-8 bg-[#121824]/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-xl shadow-sky-950/30 space-x-3 items-center pointer-events-auto hover:border-sky-500/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">Research_Paper.pdf</p>
              <p className="text-[10px] text-slate-400 font-mono">142 Pages • Vector Indexed</p>
            </div>
          </div>

          {/* Card 2: Website (Bottom Left) */}
          <div className="hidden sm:flex absolute bottom-8 left-4 sm:left-12 bg-[#121824]/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-xl shadow-sky-950/30 space-x-3 items-center pointer-events-auto hover:border-sky-500/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <Globe className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">https://docs.ai/specs</p>
              <p className="text-[10px] text-slate-400 font-mono">Live Web Crawler</p>
            </div>
          </div>

          {/* Card 3: YouTube (Top Right) */}
          <div className="hidden sm:flex absolute top-6 right-2 sm:right-8 bg-[#121824]/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-xl shadow-sky-950/30 space-x-3 items-center pointer-events-auto hover:border-sky-500/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <Video className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">Video Transcript</p>
              <p className="text-[10px] text-slate-400 font-mono">Auto-Timestamped</p>
            </div>
          </div>

          {/* Card 4: Notes (Bottom Right) */}
          <div className="hidden sm:flex absolute bottom-10 right-4 sm:right-12 bg-[#121824]/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-xl shadow-sky-950/30 space-x-3 items-center pointer-events-auto hover:border-sky-500/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-sky-950/60 border border-sky-800/50 flex items-center justify-center text-sky-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">Architectural Specs</p>
              <p className="text-[10px] text-slate-400 font-mono">Markdown Format</p>
            </div>
          </div>

          {/* Card 5: Text Prompt (Center Bottom) */}
          <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 bg-[#121824]/95 backdrop-blur-md border border-sky-500/30 p-3 rounded-xl shadow-2xl shadow-sky-950/50 flex items-center space-x-3 pointer-events-auto">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-300">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">Raw Context & Prompt</p>
              <p className="text-[10px] text-sky-400 font-mono">Instant Contextual Ingest</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
