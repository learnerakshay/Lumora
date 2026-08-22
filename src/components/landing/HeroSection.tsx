import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { HeroCoreCanvas } from './HeroCoreCanvas';
import { FileText, Globe, Video, FileCode, ArrowRight, Sparkles, FlaskConical, FileJson2, Briefcase } from 'lucide-react';
import gsap from 'gsap';
import { CitationTag } from './CitationTag';

const HERO_CONNECTIONS = [
  'M 180 58 C 305 64, 358 166, 463 218',
  'M 184 357 C 305 347, 365 290, 462 252',
  'M 820 68 C 696 72, 641 169, 537 218',
  'M 816 350 C 694 344, 636 290, 538 252',
];

const HERO_SOURCE_COLORS = ['#fb7185', '#22d3ee', '#f87171', '#a78bfa'];

// One-click preset queries below the headline — a self-playing, clearly
// scripted preview (typewriter-revealed, never a real backend call) in the
// same spirit as EvidenceTrustSection's own scripted grounded/general demo,
// so a visitor can see the shape of a grounded answer before signing up.
interface PresetQuery {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  question: string;
  answer: string;
  citation?: { source: string; coordinate: string; excerpt: string; score: string };
}

const PRESET_QUERIES: PresetQuery[] = [
  {
    id: 'attention-math',
    icon: FlaskConical,
    label: 'Cross-check Transformer Attention Math',
    question: 'Do my sources agree on the attention formula?',
    answer:
      "Both sources agree on the scaled dot-product formula, but Research.pdf adds the reasoning behind the 1/√dₖ scaling term that docs.ai/specs omits.",
    citation: {
      source: 'Research.pdf',
      coordinate: 'Page 3',
      excerpt: 'The 1/√dₖ scaling term keeps dot-product magnitudes stable as dimensionality grows, preventing softmax saturation.',
      score: '0.93 match',
    },
  },
  {
    id: 'webhook-spec',
    icon: FileJson2,
    label: 'Extract API Webhook Spec',
    question: 'What does the webhook payload look like?',
    answer:
      'docs.ai/specs defines a POST endpoint with an HMAC-SHA256 signature header — Lumora extracts the exact field names and their order.',
    citation: {
      source: 'docs.ai/specs',
      coordinate: 'Section 2',
      excerpt: 'Requests are signed with HMAC-SHA256 over the raw body; verify the signature before parsing the payload as JSON.',
      score: '0.89 match',
    },
  },
  {
    id: 'role-gap-check',
    icon: Briefcase,
    label: 'Full-Stack Role Gap Check',
    question: 'How ready am I for a Full-Stack Lead role?',
    answer:
      'Your evidence covers TypeScript and API design well — Cloud Architecture and Vector DBs show the largest gaps against this role.',
  },
];

const TYPEWRITER_MS_PER_CHAR = 14;

export function HeroSection() {
  const { isSignedIn } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const coreBounceRef = useRef<HTMLDivElement>(null);
  const [activeConnection, setActiveConnection] = useState<number | null>(null);
  const [coreHovered, setCoreHovered] = useState(false);
  const pulseTimeoutRef = useRef<number | null>(null);
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);
  const [revealedChars, setRevealedChars] = useState(0);

  const activeQuery = PRESET_QUERIES.find((query) => query.id === activeQueryId) ?? null;

  useEffect(() => {
    if (!activeQuery) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setRevealedChars(activeQuery.answer.length);
      return;
    }
    setRevealedChars(0);
    const interval = window.setInterval(() => {
      setRevealedChars((count) => {
        if (count >= activeQuery.answer.length) {
          window.clearInterval(interval);
          return count;
        }
        return count + 1;
      });
    }, TYPEWRITER_MS_PER_CHAR);
    return () => window.clearInterval(interval);
  }, [activeQuery]);

  // A fast pulse (700ms) travels the connection line on hover/focus; when it
  // "arrives" the orb bumps once — a discrete cue layered on top of the
  // continuous energy-boost HeroCoreCanvas already applies while hovered.
  const triggerCoreArrivalPulse = () => {
    const el = coreBounceRef.current;
    if (!el) return;
    el.classList.remove('hero-core-arrival');
    void el.offsetWidth;
    el.classList.add('hero-core-arrival');
  };

  const activateConnection = (connectionIndex: number) => {
    setActiveConnection(connectionIndex);
    if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = window.setTimeout(triggerCoreArrivalPulse, 700);
  };

  const deactivateConnection = () => {
    setActiveConnection(null);
    if (pulseTimeoutRef.current) {
      window.clearTimeout(pulseTimeoutRef.current);
      pulseTimeoutRef.current = null;
    }
  };

  // Focusable + operable by keyboard, mirroring the pointer behavior exactly
  // (:focus-visible gets the identical state via shared CSS below).
  const cardInteractionProps = (connectionIndex: number) => ({
    onPointerEnter: () => activateConnection(connectionIndex),
    onPointerLeave: deactivateConnection,
    onFocus: () => activateConnection(connectionIndex),
    onBlur: deactivateConnection,
    tabIndex: 0,
  });

  // Touch devices have no hover: auto-cycle the highlight through the four
  // chips instead, so the constellation still demonstrates itself.
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = window.matchMedia('(hover: none)').matches;
    if (!isTouch || prefersReducedMotion) return;
    let index = 0;
    const interval = window.setInterval(() => {
      index = (index + 1) % HERO_CONNECTIONS.length;
      setActiveConnection(index);
    }, 2500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.36 } });

      tl.fromTo(
        badgeRef.current,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, delay: 0.05, duration: 0.32 },
      )
        .fromTo(
          headlineRef.current,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1 },
          '-=0.18',
        )
        .fromTo(
          sublineRef.current,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1 },
          '-=0.2'
        )
        .fromTo(
          coreRef.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.38 },
          '-=0.18',
        )
        .fromTo(
          ctaRef.current,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1 },
          '-=0.24'
        )
        .fromTo(
          cardsRef.current ? cardsRef.current.children : [],
          {
            opacity: 0,
            x: (index: number) => (index < 2 ? -16 : 16),
            y: (index: number) => (index % 2 === 0 ? -8 : 8),
          },
          { opacity: 1, x: 0, y: 0, stagger: 0.07, duration: 0.36 },
          '-=0.2'
        );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="overview"
      ref={heroRef}
      className="landing-section relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 pb-10 pt-10 sm:px-6 sm:pb-14 lg:px-8"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="landing-aurora absolute left-1/2 top-[18%] h-[520px] w-[min(86vw,920px)] -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-500/15 via-cyan-500/8 to-blue-500/12 opacity-70 blur-[120px]" />
        <div className="absolute right-[8%] top-4 h-72 w-80 rounded-full bg-sky-400/8 blur-[110px]" />
        <div className="absolute inset-x-0 bottom-0 z-10 h-56 bg-gradient-to-t from-[#070b12] via-[#070b12]/72 to-transparent" />
      </div>

      <div className="relative z-20 mx-auto max-w-5xl space-y-5 text-center sm:space-y-6">
        {/* Eyebrow badge */}
        <div ref={badgeRef} className="inline-flex items-center space-x-2 rounded-full border border-sky-800/60 bg-sky-950/65 px-3.5 py-1.5 text-xs font-medium tracking-wide text-sky-300 shadow-[0_0_32px_rgba(14,165,233,0.08)]">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Built for focused, source-grounded learning</span>
        </div>

        {/* Main Headline */}
        <h1
          ref={headlineRef}
          className="mx-auto max-w-4xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent">
            Evidence for what you know.
          </span>
          <br />
          A path for what you don&apos;t.
        </h1>

        {/* Supporting Copy */}
        <p
          ref={sublineRef}
          className="mx-auto max-w-2xl text-sm font-normal leading-relaxed text-slate-300 sm:text-base lg:text-lg"
        >
          Bring PDFs, websites, videos, and notes into a Workspace for grounded, cited answers — or bring your resume
          and let Career Intelligence show you where you stand and what to learn next.
        </p>

        {/* One-click preset queries — clearly-scripted preview, not a live call */}
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 pt-1">
          {PRESET_QUERIES.map((query) => {
            const isActive = query.id === activeQueryId;
            return (
              <button
                key={query.id}
                type="button"
                onClick={() => setActiveQueryId(isActive ? null : query.id)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  isActive
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <query.icon className="h-3.5 w-3.5" />
                <span>{query.label}</span>
              </button>
            );
          })}
        </div>

        {activeQuery && (
          <div className="hero-query-preview mx-auto max-w-xl rounded-2xl border border-slate-800 bg-[#0d1420]/90 p-4 text-left shadow-xl shadow-black/30 backdrop-blur-md">
            <p className="text-[11px] font-medium text-slate-400">{activeQuery.question}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-200">
              {activeQuery.answer.slice(0, revealedChars)}
              {revealedChars < activeQuery.answer.length && (
                <span aria-hidden="true" className="hero-query-caret ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] bg-sky-300" />
              )}
            </p>
            {activeQuery.citation && revealedChars >= activeQuery.answer.length && (
              <div className="mt-3 animate-fade-in">
                <CitationTag
                  source={activeQuery.citation.source}
                  coordinate={activeQuery.citation.coordinate}
                  excerpt={activeQuery.citation.excerpt}
                  score={activeQuery.citation.score}
                  className="inline-flex items-center gap-1.5 rounded border border-sky-900/70 bg-sky-950/40 px-1.5 py-0.5 text-[10px] text-sky-300"
                >
                  {activeQuery.citation.source} <span className="text-slate-500">{activeQuery.citation.coordinate}</span>
                </CitationTag>
              </div>
            )}
          </div>
        )}

        {/* Primary CTA & Secondary */}
        <div ref={ctaRef} className="pt-2 flex flex-col items-center space-y-3">
          {isSignedIn ? (
            <Link
              to="/workspaces"
              className="landing-primary-cta group inline-flex items-center space-x-2 rounded-xl bg-sky-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/25 hover:bg-sky-300"
            >
              <span>Open Lumora</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/sign-in"
              className="landing-primary-cta group inline-flex items-center space-x-2 rounded-xl bg-sky-400 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/25 hover:bg-sky-300"
            >
              <span>Try Lumora now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <p className="text-xs text-slate-400 tracking-wide">
            Start with your own sources and learn in one focused Workspace.
          </p>
        </div>
      </div>

      {/* Hero Canvas & Floating Source Cards Layout */}
      <div className="relative z-10 mx-auto -mt-2 w-full max-w-6xl sm:mt-0">
        {/* Three.js Lumora Core Canvas */}
        <div ref={coreRef} className="h-[300px] w-full sm:h-[370px] lg:h-[410px]">
          <div ref={coreBounceRef} className="h-full w-full">
            <HeroCoreCanvas
              onHoverChange={setCoreHovered}
              activeSourceColor={activeConnection === null ? null : HERO_SOURCE_COLORS[activeConnection]}
            />
          </div>
        </div>

        <svg
          aria-hidden="true"
          className={`hero-connections pointer-events-none absolute inset-0 z-[1] hidden h-full w-full sm:block ${activeConnection !== null ? 'has-active' : ''}`}
          viewBox="0 0 1000 470"
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="hero-connection-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {HERO_CONNECTIONS.map((path, index) => {
            const isActive = activeConnection === index;
            return (
              <g
                key={path}
                className={`hero-connection ${isActive ? 'is-active' : ''} ${coreHovered ? 'is-core-active' : ''}`}
                style={{ '--source-energy': HERO_SOURCE_COLORS[index] } as React.CSSProperties}
              >
                <path className="hero-connection-line" d={path} />
                <path
                  className="hero-connection-pulse"
                  d={path}
                  pathLength="1"
                  style={{ '--connection-delay': `${index * -0.9}s` } as React.CSSProperties}
                />
                {isActive && <path key={`fast-${index}`} className="hero-connection-fast-pulse" d={path} pathLength="1" />}
              </g>
            );
          })}
        </svg>

        {/* Floating Source Cards Overlay */}
        <div
          ref={cardsRef}
          className="absolute inset-0 pointer-events-none flex flex-wrap items-center justify-between p-4 sm:p-6"
        >
          {/* Card 1: PDF (Top Left) */}
          <div {...cardInteractionProps(0)} data-source="pdf" style={{ '--float-duration': '8.4s', '--float-delay': '-1.7s', '--float-x': '4px', '--float-rotate': '-0.45deg' } as React.CSSProperties} className="landing-source-card absolute left-2 top-4 hidden items-center space-x-3 rounded-xl border border-slate-800 bg-[#101826]/90 p-3 shadow-xl shadow-sky-950/30 backdrop-blur-md pointer-events-auto sm:left-8 sm:flex">
            <div className="w-9 h-9 rounded-lg bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">Research_Paper.pdf</p>
              <p className="text-[10px] text-slate-400 font-mono">PDF document</p>
            </div>
          </div>

          {/* Card 2: Website (Bottom Left) */}
          <div {...cardInteractionProps(1)} data-source="website" style={{ '--float-duration': '9.6s', '--float-delay': '-4.2s', '--float-x': '-5px', '--float-rotate': '0.35deg' } as React.CSSProperties} className="landing-source-card absolute bottom-8 left-4 hidden items-center space-x-3 rounded-xl border border-slate-800 bg-[#101826]/90 p-3 shadow-xl shadow-sky-950/30 backdrop-blur-md pointer-events-auto sm:left-12 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-800/50 bg-cyan-950/60 text-cyan-300">
              <Globe className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">https://docs.ai/specs</p>
              <p className="text-[10px] text-slate-400 font-mono">Web page</p>
            </div>
          </div>

          {/* Card 3: YouTube (Top Right) */}
          <div {...cardInteractionProps(2)} data-source="youtube" style={{ '--float-duration': '9.1s', '--float-delay': '-3.1s', '--float-x': '5px', '--float-rotate': '0.5deg' } as React.CSSProperties} className="landing-source-card absolute right-2 top-6 hidden items-center space-x-3 rounded-xl border border-slate-800 bg-[#101826]/90 p-3 shadow-xl shadow-sky-950/30 backdrop-blur-md pointer-events-auto sm:right-8 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/60 text-red-400">
              <Video className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">YouTube Video</p>
              <p className="text-[10px] text-slate-400 font-mono">Video transcript</p>
            </div>
          </div>

          {/* Card 4: Plain Text (Bottom Right) */}
          <div {...cardInteractionProps(3)} data-source="text" style={{ '--float-duration': '8.9s', '--float-delay': '-5.4s', '--float-x': '-4px', '--float-rotate': '-0.3deg' } as React.CSSProperties} className="landing-source-card absolute bottom-10 right-4 hidden items-center space-x-3 rounded-xl border border-slate-800 bg-[#101826]/90 p-3 shadow-xl shadow-sky-950/30 backdrop-blur-md pointer-events-auto sm:right-12 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-800/50 bg-violet-950/60 text-violet-300">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200">Plain Text Notes</p>
              <p className="text-[10px] text-slate-400 font-mono">Text source</p>
            </div>
          </div>

        </div>
      </div>

      <div aria-hidden="true" className="landing-stream-bridge pointer-events-none absolute inset-x-0 bottom-0 z-10 h-52 overflow-hidden sm:h-64">
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            style={{
              '--stream-left': `${16 + index * 8.5}%`,
              '--stream-rotation': `${(index - 4) * 2.4}deg`,
              '--stream-duration': `${2.7 + index * 0.17}s`,
              '--stream-delay': `${index * -0.31}s`,
            } as React.CSSProperties}
          />
        ))}
        <div className="absolute bottom-0 left-1/2 h-20 w-px -translate-x-1/2 bg-gradient-to-b from-sky-300/70 to-transparent shadow-[0_0_18px_rgba(56,189,248,0.8)]" />
      </div>
    </section>
  );
}
