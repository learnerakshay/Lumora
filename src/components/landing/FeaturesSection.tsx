import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, Clock, Crown, FileCode, FileText, Globe, Layers3, Lock, MessageSquareText, Video, Zap } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const V1_FEATURES = [
  {
    icon: Lock,
    title: 'Workspace Isolation',
    description: 'Strict database and API multi-tenancy rules ensuring workspace data stays isolated.',
    badge: 'Core V1',
  },
  {
    icon: MessageSquareText,
    title: 'AI Workspace Chat',
    description: 'Conversational agent grounded strictly in your uploaded sources with full history.',
    badge: 'Core V1',
  },
  {
    icon: Layers3,
    title: 'Multi-source Research',
    description: 'Query and synthesize insights across PDFs, websites, YouTube videos, and notes concurrently.',
    badge: 'Core V1',
  },
  {
    icon: FileText,
    title: 'PDF Intelligence',
    description: 'High-density PDF parsing with page-level vector indexing and chunk extraction.',
    badge: 'Core V1',
  },
  {
    icon: Globe,
    title: 'Website Intelligence',
    description: 'Live web scraping and DOM extraction to import documentation and articles.',
    badge: 'Core V1',
  },
  {
    icon: Video,
    title: 'YouTube Intelligence',
    description: 'Automatic transcript extraction with timestamp-aligned vector chunks.',
    badge: 'Core V1',
  },
  {
    icon: FileCode,
    title: 'Plain Text Support',
    description: 'Instant ingestion of Markdown, code snippets, logs, and raw text prompts.',
    badge: 'Core V1',
  },
  {
    icon: Clock,
    title: 'VTT Support',
    description: 'Full subtitle file support with timestamp tracking for media transcripts.',
    badge: 'Core V1',
  },
  {
    icon: Zap,
    title: 'Streaming Responses',
    description: 'Token-by-token streaming AI responses powered by OpenAI API integration.',
    badge: 'Core V1',
  },
  {
    icon: Bookmark,
    title: 'Source Citations',
    description: 'Interactive citation pills inline with AI answers pointing to exact source chunks.',
    badge: 'Core V1',
  },
];

const FUTURE_ROADMAP = [
  { title: 'Audio Podcasts', desc: 'Synthetic AI audio research summaries' },
  { title: 'Interactive Flashcards', desc: 'Spaced repetition study decks' },
  { title: 'Public Workspaces', desc: 'Shareable community knowledge hubs' },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          once: true,
        },
      });
      timeline
        .fromTo(
          headingRef.current,
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
        )
        .fromTo(
          gridRef.current ? gridRef.current.children : [],
          { opacity: 0, y: 25 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.075,
            duration: 0.58,
            ease: 'power2.out',
          },
          '-=0.28',
        );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="landing-section relative px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Title */}
        <div ref={headingRef} className="mx-auto max-w-3xl space-y-3 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-sky-400 text-xs font-mono uppercase tracking-wider">
            <span>Production Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Version 1 Core Features
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Every feature in Lumora V1 is engineered for accuracy, speed, and strict source grounding.
          </p>
        </div>

        {/* Features Grid */}
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {V1_FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="landing-card group flex min-h-52 flex-col rounded-2xl border border-slate-800/90 bg-[#101826]/95 p-6 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="landing-icon flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-sky-400 group-hover:bg-sky-950/40">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-sky-950/60 text-sky-300 text-[10px] font-mono border border-sky-800/40 font-medium">
                    {feature.badge}
                  </span>
                </div>

                <div className="relative z-10 mt-4 space-y-1.5">
                  <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {feature.title === 'AI Workspace Chat' ? (
                  <div className="landing-chat-demo relative z-10 mt-auto pt-4" aria-hidden="true">
                    <div className="rounded-lg border border-sky-900/70 bg-slate-950/70 px-2.5 py-2 text-[9px] text-slate-300">
                      Summarize the strongest finding
                    </div>
                    <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2">
                      <div className="flex min-w-0 items-center gap-2 text-[9px] text-slate-300">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                        <span className="min-w-0 flex-1 overflow-hidden text-left">
                          <span className="landing-stream-copy">The evidence converges on one key insight.</span>
                          <span className="landing-stream-cursor" />
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="rounded border border-sky-900 px-1.5 py-0.5 text-[8px] text-sky-300">Research.pdf</span>
                        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[8px] text-slate-400">Page 3</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="landing-signal relative z-10 mt-auto"
                    style={{ '--signal-delay': `${idx * -0.18}s` } as React.CSSProperties}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Intentional locked roadmap presentation; no unavailable action is exposed. */}
        <div className="mx-auto max-w-4xl space-y-6 border-t border-slate-800/80 pt-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-800/50 bg-sky-950/30 px-3 py-1 text-[11px] font-semibold text-sky-300">
            <Crown className="h-3.5 w-3.5" />
            <span>Lumora Pro · Product Roadmap</span>
          </div>
          <div className="mx-auto max-w-xl space-y-2">
            <h3 className="text-xl font-bold text-white">Advanced experiences, intentionally gated</h3>
            <p className="text-xs leading-6 text-slate-400">
              These capabilities are not part of the current release. Core Workspace functionality remains fully available.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {FUTURE_ROADMAP.map((item, i) => (
              <article
                key={i}
                aria-disabled="true"
                className="landing-card landing-roadmap-card group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0d131f]/88 p-4 text-left shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400">
                    <Lock className="landing-lock h-3.5 w-3.5" />
                  </div>
                  <span className="rounded-full border border-sky-800/40 bg-sky-950/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300">
                    Planned
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-200">{item.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.desc}</p>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                  <Lock className="h-3 w-3" />
                  <span>Not available in Version 1</span>
                </div>
              </article>
            ))}
          </div>

          <Link
            to="/sign-in"
            className="landing-primary-cta inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/20 hover:bg-sky-400"
          >
            <span>Continue with Lumora Core</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
