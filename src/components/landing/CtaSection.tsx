import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { ArrowRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ConvergingParticle {
  left: number;
  top: number;
  dx: number;
  dy: number;
  size: number;
  duration: number;
  delay: number;
}

// Particles start near the edges and drift toward the center as they fade
// — "all processed information converging into a path forward" — computed
// once at module load, never re-randomized on re-render.
const CTA_PARTICLES: ConvergingParticle[] = Array.from({ length: 20 }, () => {
  const left = Math.random() * 100;
  const top = Math.random() * 100;
  return {
    left,
    top,
    dx: (50 - left) * (0.5 + Math.random() * 0.3),
    dy: (50 - top) * (0.5 + Math.random() * 0.3),
    size: 1.5 + Math.random() * 2,
    duration: 7 + Math.random() * 6,
    delay: -(Math.random() * 10),
  };
});

export function CtaSection() {
  const { isSignedIn } = useAuth();
  const ctaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const atmosphereRef = useRef<HTMLDivElement>(null);

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
          duration: 0.38,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: ctaRef.current,
            start: 'top 80%',
          },
        }
      );
    }, ctaRef);

    let raf = 0;
    let latestX = 0;
    let latestY = 0;
    const apply = () => {
      raf = 0;
      atmosphereRef.current?.style.setProperty('--cta-parallax-x', `${latestX}px`);
      atmosphereRef.current?.style.setProperty('--cta-parallax-y', `${latestY}px`);
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = ctaRef.current?.getBoundingClientRect();
      if (!rect) return;
      latestX = ((event.clientX - rect.left) / rect.width - 0.5) * 14;
      latestY = ((event.clientY - rect.top) / rect.height - 0.5) * 10;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    ctaRef.current?.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      ctx.revert();
      ctaRef.current?.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      ref={ctaRef}
      className="landing-section landing-horizon relative overflow-hidden px-4 pb-20 pt-24 text-center sm:px-6 lg:px-8"
    >
      {/* Faint separation from Pricing above — a hairline, not a hard rule */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent"
      />

      {/* Cinematic closing atmosphere — slow teal aurora + converging data
          particles + a faint cursor parallax. Deliberately no knowledge
          sphere here; that visual stays unique to the hero. */}
      <div ref={atmosphereRef} className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute bottom-0 left-1/2 h-[400px] w-[min(900px,90vw)] -translate-x-1/2 rounded-full bg-gradient-to-t from-sky-500/15 via-blue-500/8 to-transparent blur-[140px]"
          style={{ transform: 'translate(calc(-50% + var(--cta-parallax-x, 0px)), var(--cta-parallax-y, 0px))' }}
        />
        <div className="cta-aurora cta-aurora-a absolute left-[18%] top-[6%] h-[380px] w-[min(70vw,720px)] rounded-full bg-gradient-to-tr from-cyan-500/12 via-sky-400/6 to-transparent opacity-55 blur-[130px]" />
        <div className="cta-aurora cta-aurora-b absolute right-[12%] top-[22%] h-[340px] w-[min(60vw,640px)] rounded-full bg-gradient-to-tl from-indigo-500/10 via-blue-500/6 to-transparent opacity-45 blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-950/20 via-transparent to-transparent pointer-events-none" />
        <div
          className="cta-particle-field absolute inset-0"
          style={{ transform: 'translate3d(var(--cta-parallax-x, 0px), var(--cta-parallax-y, 0px), 0)' }}
        >
          {CTA_PARTICLES.map((particle, index) => (
            <span
              key={index}
              className="cta-converge-particle"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                '--converge-dx': `${particle.dx}vw`,
                '--converge-dy': `${particle.dy}vh`,
                '--converge-duration': `${particle.duration}s`,
                '--converge-delay': `${particle.delay}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      <div ref={contentRef} className="max-w-4xl mx-auto space-y-8 relative z-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-sky-950/70 border border-sky-800/60 text-sky-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Your path starts here</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
          Stop trusting answers you can&apos;t{' '}
          <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent">
            check.
          </span>
        </h2>

        <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto font-normal">
          Bring your sources in. Get answers you can trace back — and a clear path for everything you haven&apos;t
          learned yet.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-[11px] text-slate-500">
          <span>4 source types</span>
          <span aria-hidden="true">·</span>
          <span>Citation-verified answers</span>
          <span aria-hidden="true">·</span>
          <span>Free plan, no card</span>
        </div>

        <div className="pt-2 flex flex-col items-center space-y-3">
          {isSignedIn ? (
            <Link
              to="/workspaces"
              className="landing-primary-cta inline-flex items-center space-x-2 rounded-xl bg-sky-400 px-8 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-sky-500/25 hover:bg-sky-300"
            >
              <span>Open Lumora</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/sign-in"
              className="landing-primary-cta inline-flex items-center space-x-2 rounded-xl bg-sky-400 px-8 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-sky-500/25 hover:bg-sky-300"
            >
              <span>Start Learning</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <p className="text-xs text-slate-400 font-mono">
            No credit card required to get started.
          </p>
        </div>
      </div>
    </section>
  );
}
