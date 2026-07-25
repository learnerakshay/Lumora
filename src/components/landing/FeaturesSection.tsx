import React, { useEffect, useRef } from 'react';
import { Layers, MessageSquareText, Layers3, FileText, Globe, Video, FileCode, Clock, Zap, Bookmark, Sparkles, Lock } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const V1_FEATURES = [
  {
    icon: Lock,
    title: 'Workspace Isolation',
    description: 'Strict database and API multi-tenancy rules ensuring workspace data stays isolated.',
    badge: 'Core V1',
    color: 'sky',
  },
  {
    icon: MessageSquareText,
    title: 'AI Workspace Chat',
    description: 'Conversational agent grounded strictly in your uploaded sources with full history.',
    badge: 'Core V1',
    color: 'sky',
  },
  {
    icon: Layers3,
    title: 'Multi-source Research',
    description: 'Query and synthesize insights across PDFs, websites, YouTube videos, and notes concurrently.',
    badge: 'Core V1',
    color: 'teal',
  },
  {
    icon: FileText,
    title: 'PDF Intelligence',
    description: 'High-density PDF parsing with page-level vector indexing and chunk extraction.',
    badge: 'Core V1',
    color: 'red',
  },
  {
    icon: Globe,
    title: 'Website Intelligence',
    description: 'Live web scraping and DOM extraction to import documentation and articles.',
    badge: 'Core V1',
    color: 'emerald',
  },
  {
    icon: Video,
    title: 'YouTube Intelligence',
    description: 'Automatic transcript extraction with timestamp-aligned vector chunks.',
    badge: 'Core V1',
    color: 'amber',
  },
  {
    icon: FileCode,
    title: 'Plain Text Support',
    description: 'Instant ingestion of Markdown, code snippets, logs, and raw text prompts.',
    badge: 'Core V1',
    color: 'indigo',
  },
  {
    icon: Clock,
    title: 'VTT Support',
    description: 'Full subtitle file support with timestamp tracking for media transcripts.',
    badge: 'Core V1',
    color: 'teal',
  },
  {
    icon: Zap,
    title: 'Streaming Responses',
    description: 'Token-by-token streaming AI responses powered by OpenAI API integration.',
    badge: 'Core V1',
    color: 'amber',
  },
  {
    icon: Bookmark,
    title: 'Source Citations',
    description: 'Interactive citation pills inline with AI answers pointing to exact source chunks.',
    badge: 'Core V1',
    color: 'sky',
  },
];

const FUTURE_ROADMAP = [
  { title: 'Audio Podcasts', desc: 'Synthetic AI audio research summaries' },
  { title: 'Interactive Flashcards', desc: 'Spaced repetition study decks' },
  { title: 'Public Workspaces', desc: 'Shareable community knowledge hubs' },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        gridRef.current ? gridRef.current.children : [],
        { opacity: 0, y: 25 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.08,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: gridRef.current,
            start: 'top 80%',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0b0f17] border-t border-slate-800/60 relative"
    >
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Title */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
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
                className="p-6 bg-[#121824] border border-slate-800/90 hover:border-sky-500/40 rounded-2xl space-y-4 transition-all duration-200 group hover:-translate-y-1 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 group-hover:border-sky-500/50 group-hover:bg-sky-950/40 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-sky-950/60 text-sky-300 text-[10px] font-mono border border-sky-800/40 font-medium">
                    {feature.badge}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Future Roadmap Section */}
        <div className="pt-8 border-t border-slate-800/80 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 text-[11px] font-mono">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Future Expansion Roadmap</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FUTURE_ROADMAP.map((item, i) => (
              <div
                key={i}
                className="p-4 bg-[#0d131f]/60 border border-slate-800/60 rounded-xl text-left space-y-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400">
                  Upcoming
                </span>
                <p className="text-xs font-semibold text-slate-300">{item.title}</p>
                <p className="text-[11px] text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
