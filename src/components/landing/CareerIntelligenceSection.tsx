import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Brain,
  FileSearch,
  Flag,
  FolderPlus,
  Gauge,
  GraduationCap,
  ListChecks,
  ListOrdered,
  Wrench,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '../AuthProvider';
import { SpotlightCard } from './motion/SpotlightCard';
import { CompetencyRadar } from './CompetencyRadar';

gsap.registerPlugin(ScrollTrigger);

const CAREER_STEPS = [
  { key: 'resume', label: 'Resume / CV', icon: FileSearch, detail: 'Upload a resume or paste its text.' },
  { key: 'skill-evidence', label: 'Skill Evidence', icon: Brain, detail: 'Lumora extracts each skill and the evidence behind it.' },
  { key: 'target-role', label: 'Target Role', icon: Flag, detail: 'You choose the role you’re aiming for.' },
  { key: 'role-fit', label: 'Role Fit', icon: Gauge, detail: 'An explainable fit score shows how close you are.' },
  { key: 'gap-detection', label: 'Gap Detection', icon: ListChecks, detail: 'Missing or weak skills surface as specific, evidence-based gaps.' },
  { key: 'gap-prioritization', label: 'Gap Prioritization', icon: ListOrdered, detail: 'Gaps are ranked by severity and impact.' },
  { key: 'gap-filling', label: 'Gap Filling', icon: Wrench, detail: 'Selected gaps become concrete closure steps.' },
  { key: 'learning-path', label: 'Learning Path', icon: GraduationCap, detail: 'A staged plan for closing each gap, in order.' },
  { key: 'resources', label: 'Recommended Resources', icon: BookOpen, detail: 'Courses, cohorts, and projects matched to each gap.' },
  { key: 'workspace', label: 'Learning Workspace', icon: FolderPlus, detail: 'Turn the plan into a Workspace and keep building evidence.' },
] as const;

const ROLE_FIT_SCORE = 78;

// Career Intelligence — Lumora's second flagship pillar, given equal
// weight to Evidence & Trust rather than folded into a generic feature
// grid. Restrained amber accent distinguishes it from the cyan Knowledge
// Intelligence sections while keeping the same dark shell.
export function CareerIntelligenceSection() {
  const { isSignedIn } = useAuth();
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const fitFillRef = useRef<HTMLDivElement>(null);
  const fitValueRef = useRef<HTMLSpanElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 72%', once: true },
      });
      timeline
        .fromTo(headingRef.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.36, ease: 'power3.out' })
        .fromTo(
          pathRef.current,
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' },
          '-=0.1',
        )
        .fromTo(
          gridRef.current ? gridRef.current.children : [],
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, stagger: 0.05, duration: 0.34, ease: 'power3.out' },
          '-=1.3',
        )
        .fromTo(ctaRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.34, ease: 'power3.out' }, '-=0.1')
        .call(() => gridRef.current?.classList.add('is-cycling'));

      // Role Fit score: explicitly set to 0 only when this timeline
      // actually runs, then count up — the static JSX value (78%) is the
      // correct resting state for reduced-motion visitors who never reach
      // this branch at all.
      if (fitFillRef.current && fitValueRef.current) {
        const counter = { value: 0 };
        gsap.set(fitFillRef.current, { width: '0%' });
        timeline.to(
          counter,
          {
            value: ROLE_FIT_SCORE,
            duration: 1.1,
            ease: 'power2.out',
            onUpdate: () => {
              if (fitValueRef.current) fitValueRef.current.textContent = `${Math.round(counter.value)}%`;
            },
          },
          '-=0.9',
        );
        timeline.to(fitFillRef.current, { width: `${ROLE_FIT_SCORE}%`, duration: 1.1, ease: 'power2.out' }, '<');
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="career-intelligence" ref={sectionRef} className="landing-section career-section relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[560px] w-[560px] rounded-full bg-violet-950/16 blur-[130px] pointer-events-none" />

      <div className="mx-auto max-w-6xl space-y-12 relative z-10">
        <div ref={headingRef} className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-violet-900/50 bg-violet-950/30 px-3 py-1 font-mono text-xs uppercase tracking-wider text-violet-300">
            <span>Career Intelligence</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">From resume to role-readiness</h2>
          <p className="text-slate-400 text-sm sm:text-base">
            A resume becomes a plan: where you stand today, what a target role expects, and the specific,
            evidence-backed steps that close the distance.
          </p>
        </div>

        <div className="relative">
          {/* Threads through all 10 cards in order, drawing itself once on
              scroll-in. Hidden below lg — at 1/2-column layouts the grid
              no longer matches this 5x2 geometry, and per spec "hidden is
              acceptable; broken is not" rather than recomputing it live. */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              ref={pathRef}
              d="M 10 25 L 30 25 L 50 25 L 70 25 L 90 25 Q 100 42 96 50 Q 50 62 10 75 L 30 75 L 50 75 L 70 75 L 90 75"
              className="career-thread-path"
              pathLength="1"
            />
          </svg>
          <div ref={gridRef} className="career-grid relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CAREER_STEPS.map((step, index) => (
            <SpotlightCard
              key={step.key}
              accent="violet"
              data-step={index}
              className="career-node relative flex flex-col gap-3 rounded-2xl border border-violet-900/25 bg-[#140f24]/70 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-800/45 bg-violet-950/35 text-violet-300">
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="font-mono text-[10px] text-slate-600">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">{step.label}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{step.detail}</p>
              </div>

              {step.key === 'role-fit' && (
                <div className="mt-1 space-y-1.5" aria-hidden="true">
                  <div className="career-fit-track h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                    <div ref={fitFillRef} className="career-fit-fill h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300" style={{ width: `${ROLE_FIT_SCORE}%` }} />
                  </div>
                  <span ref={fitValueRef} className="font-mono text-[11px] text-emerald-300">
                    {ROLE_FIT_SCORE}%
                  </span>
                </div>
              )}

              {step.key === 'gap-detection' && (
                <div className="mt-1 flex flex-wrap gap-1.5" aria-hidden="true">
                  <span className="career-gap-chip rounded-full border border-emerald-800/50 bg-emerald-950/30 px-2 py-0.5 text-[9px] font-medium text-emerald-300" style={{ '--chip-delay': '0s' } as React.CSSProperties}>
                    Strong
                  </span>
                  <span className="career-gap-chip rounded-full border border-cyan-800/50 bg-cyan-950/30 px-2 py-0.5 text-[9px] font-medium text-cyan-300" style={{ '--chip-delay': '0.5s' } as React.CSSProperties}>
                    Developing
                  </span>
                  <span className="career-gap-chip rounded-full border border-rose-800/50 bg-rose-950/30 px-2 py-0.5 text-[9px] font-medium text-rose-300" style={{ '--chip-delay': '1s' } as React.CSSProperties}>
                    Missing
                  </span>
                </div>
              )}

              {step.key === 'gap-prioritization' && (
                <div className="mt-1 flex items-end gap-1.5" aria-hidden="true">
                  <span className="career-priority-bar w-2.5 rounded-t bg-rose-500/70" style={{ '--bar-height': '22px', '--bar-delay': '0s' } as React.CSSProperties} />
                  <span className="career-priority-bar w-2.5 rounded-t bg-cyan-400/70" style={{ '--bar-height': '15px', '--bar-delay': '0.25s' } as React.CSSProperties} />
                  <span className="career-priority-bar w-2.5 rounded-t bg-slate-500/60" style={{ '--bar-height': '9px', '--bar-delay': '0.5s' } as React.CSSProperties} />
                </div>
              )}

              {step.key === 'learning-path' && (
                <div className="mt-1 flex items-center gap-1.5" aria-hidden="true">
                  <span className="career-path-dot h-1.5 w-1.5 rounded-full bg-violet-400" style={{ '--dot-delay': '0s' } as React.CSSProperties} />
                  <span className="h-px w-3 bg-violet-800/60" />
                  <span className="career-path-dot h-1.5 w-1.5 rounded-full bg-violet-400" style={{ '--dot-delay': '0.4s' } as React.CSSProperties} />
                  <span className="h-px w-3 bg-violet-800/60" />
                  <span className="career-path-dot h-1.5 w-1.5 rounded-full bg-violet-400" style={{ '--dot-delay': '0.8s' } as React.CSSProperties} />
                </div>
              )}

              {step.key === 'resources' && (
                <div className="mt-1 flex items-center gap-1.5" aria-hidden="true">
                  <span className="career-resource-icon flex h-5 w-5 items-center justify-center rounded-md border border-violet-800/40 bg-violet-950/25 text-violet-300" style={{ '--icon-delay': '0s' } as React.CSSProperties}>
                    <BookOpen className="h-2.5 w-2.5" />
                  </span>
                  <span className="career-resource-icon flex h-5 w-5 items-center justify-center rounded-md border border-violet-800/40 bg-violet-950/25 text-violet-300" style={{ '--icon-delay': '0.3s' } as React.CSSProperties}>
                    <Bookmark className="h-2.5 w-2.5" />
                  </span>
                  <span className="career-resource-icon flex h-5 w-5 items-center justify-center rounded-md border border-violet-800/40 bg-violet-950/25 text-violet-300" style={{ '--icon-delay': '0.6s' } as React.CSSProperties}>
                    <FolderPlus className="h-2.5 w-2.5" />
                  </span>
                </div>
              )}
            </SpotlightCard>
          ))}
          </div>
        </div>

        <CompetencyRadar />

        <div ref={ctaRef} className="flex justify-center">
          <Link
            to={isSignedIn ? '/skills' : '/sign-in'}
            className="career-cta inline-flex items-center gap-2 rounded-lg bg-violet-400 px-5 py-2.5 text-xs font-semibold text-slate-950 shadow-md shadow-violet-500/20 hover:bg-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            {isSignedIn ? 'Open Skill Intelligence' : 'Try Career Intelligence'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
