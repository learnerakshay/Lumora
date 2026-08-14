import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { HeroCoreCanvas } from './HeroCoreCanvas';
import { FileText, Globe, Video, FileCode, ArrowRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';

const HERO_CONNECTIONS = [
  'M 180 58 C 305 64, 358 166, 463 218',
  'M 184 357 C 305 347, 365 290, 462 252',
  'M 820 68 C 696 72, 641 169, 537 218',
  'M 816 350 C 694 344, 636 290, 538 252',
];

const HERO_SOURCE_COLORS = ['#fb7185', '#22d3ee', '#f87171', '#a78bfa'];

export function HeroSection() {
  const { isSignedIn } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const [activeConnection, setActiveConnection] = useState<number | null>(null);
  const [coreHovered, setCoreHovered] = useState(false);

  const cardInteractionProps = (connectionIndex: number) => ({
    onPointerEnter: () => setActiveConnection(connectionIndex),
    onPointerLeave: () => {
      setActiveConnection(null);
    },
  });

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
          Turn scattered knowledge into{' '}
          <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent">
            lasting understanding.
          </span>
        </h1>

        {/* Supporting Copy */}
        <p
          ref={sublineRef}
          className="mx-auto max-w-2xl text-sm font-normal leading-relaxed text-slate-300 sm:text-base lg:text-lg"
        >
          Bring PDFs, web pages, YouTube videos, and notes together, then ask questions and learn from answers grounded in your sources.
        </p>

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
          <HeroCoreCanvas onHoverChange={setCoreHovered} />
        </div>

        <svg
          aria-hidden="true"
          className="hero-connections pointer-events-none absolute inset-0 z-[1] hidden h-full w-full sm:block"
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

      <div aria-hidden="true" className="landing-stream-bridge absolute inset-x-0 bottom-0 z-10 h-52 overflow-hidden sm:h-64">
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
