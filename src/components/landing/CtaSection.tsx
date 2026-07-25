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
      className="py-28 px-4 sm:px-6 lg:px-8 bg-[#0b0f17] border-t border-slate-800/60 relative overflow-hidden text-center"
    >
      {/* Observatory Ambient Background Lights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-t from-sky-500/15 via-indigo-500/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-950/20 via-transparent to-transparent pointer-events-none" />
      </div>

      <div ref={contentRef} className="max-w-4xl mx-auto space-y-8 relative z-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-sky-950/70 border border-sky-800/60 text-sky-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Observatory Access</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
          Ready to build your{' '}
          <span className="bg-gradient-to-r from-sky-300 via-teal-200 to-indigo-300 bg-clip-text text-transparent">
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
              className="inline-flex items-center space-x-2 px-8 py-4 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-sm transition-all shadow-xl shadow-sky-500/25 hover:shadow-sky-400/40 cursor-pointer"
            >
              <span>Go to Workspaces</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/sign-in"
              className="inline-flex items-center space-x-2 px-8 py-4 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-sm transition-all shadow-xl shadow-sky-500/25 hover:shadow-sky-400/40 cursor-pointer"
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
