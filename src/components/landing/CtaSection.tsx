import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { ArrowRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function CtaSection() {
  const { isSignedIn } = useAuth();
  const ctaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: ctaRef.current,
            start: 'top 80%',
          },
        }
      );
    }, ctaRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ctaRef}
      className="landing-section landing-horizon relative overflow-hidden px-4 py-28 text-center sm:px-6 lg:px-8"
    >
      {/* Observatory Ambient Background Lights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[min(900px,90vw)] -translate-x-1/2 rounded-full bg-gradient-to-t from-sky-500/15 via-blue-500/8 to-transparent blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-950/20 via-transparent to-transparent pointer-events-none" />
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            className="cta-particle absolute h-1 w-1 rounded-full bg-sky-300"
            style={{
              left: `${8 + ((index * 17) % 84)}%`,
              top: `${12 + ((index * 29) % 68)}%`,
              '--particle-delay': `${index * -0.37}s`,
              '--particle-duration': `${5.5 + (index % 5) * 0.8}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div ref={contentRef} className="max-w-4xl mx-auto space-y-8 relative z-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-sky-950/70 border border-sky-800/60 text-sky-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Observatory Access</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
          Ready to build your{' '}
          <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent">
            knowledge system?
          </span>
        </h2>

        <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto font-normal">
          Experience the power of a dedicated AI Knowledge Operating System with workspace isolation, vector retrieval, and grounded AI responses.
        </p>

        <div className="pt-4 flex flex-col items-center space-y-3">
          {isSignedIn ? (
            <Link
              to="/workspaces"
              className="landing-primary-cta inline-flex items-center space-x-2 rounded-xl bg-sky-400 px-8 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-sky-500/25 hover:bg-sky-300"
            >
              <span>Go to Workspaces</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/sign-in"
              className="landing-primary-cta inline-flex items-center space-x-2 rounded-xl bg-sky-400 px-8 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-sky-500/25 hover:bg-sky-300"
            >
              <span>Try Lumora Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <p className="text-xs text-slate-400 font-mono">
            No credit card required. Free Developer Workspace tier included.
          </p>
        </div>
      </div>
    </section>
  );
}
