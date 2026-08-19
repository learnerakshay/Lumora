import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { useAuth } from '../AuthProvider';
import { Reveal } from './motion/Reveal';

const AXES = ['System Design', 'RAG Pipelines', 'TypeScript', 'Vector DBs', 'Cloud Architecture', 'API Security'] as const;

// A single illustrative candidate ("your resume") measured against three
// different target-role benchmarks — deterministic, hand-set numbers for
// demonstration, in the same spirit as this section's existing 78% Role Fit
// figure. Real gap analysis runs on a real resume inside Skill Intelligence
// (the CTA below links there); this widget is a preview of the shape of it.
const CANDIDATE_LEVELS = [72, 58, 88, 45, 60, 50] as const;

interface RoleProfile {
  id: string;
  label: string;
  target: number[];
}

const ROLES: RoleProfile[] = [
  { id: 'ai-systems', label: 'AI Systems Engineer', target: [85, 90, 75, 88, 70, 65] },
  { id: 'fullstack-lead', label: 'Full-Stack Lead', target: [70, 40, 90, 50, 75, 60] },
  { id: 'rag-specialist', label: 'RAG Specialist', target: [60, 95, 70, 92, 55, 70] },
];

const AXIS_ADVICE: Record<(typeof AXES)[number], string> = {
  'System Design': 'Practice designing scalable systems end-to-end — data flow, failure modes, and trade-offs.',
  'RAG Pipelines': 'Build a small retrieval-augmented pipeline: chunking, embeddings, and a grounding gate.',
  TypeScript: 'Deepen type-safe patterns — generics, discriminated unions, and strict null handling.',
  'Vector DBs': 'Get hands-on with a vector database — indexing, similarity search, and recall tuning.',
  'Cloud Architecture': 'Deploy and operate a real service — provisioning, scaling, and observability.',
  'API Security': 'Practice securing an API — auth, input validation, and safe secret handling.',
};

type GapLevel = 'strong' | 'developing' | 'missing';

const LEVEL_STYLES: Record<GapLevel, string> = {
  strong: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300',
  developing: 'border-cyan-800/50 bg-cyan-950/30 text-cyan-300',
  missing: 'border-rose-800/50 bg-rose-950/30 text-rose-300',
};

const CENTER = 100;
const RADIUS = 78;

function axisAngle(index: number) {
  return (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
}

function axisPoint(index: number, value: number): [number, number] {
  const angle = axisAngle(index);
  const r = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function polygonPoints(values: number[]): string {
  return values.map((value, index) => axisPoint(index, value).join(',')).join(' ');
}

const GRID_RINGS = [0.25, 0.5, 0.75, 1];

// Interactive SVG competency radar with role-switching (GSAP-tweened polygon
// morph, matching the counter-tween pattern this section already uses for
// Role Fit) plus a derived 3-stage sprint roadmap for whichever gaps are
// largest against the selected role. Purely additive — sits below the
// existing 10-node pipeline grid, doesn't replace it.
export function CompetencyRadar() {
  const { isSignedIn } = useAuth();
  const [activeRoleId, setActiveRoleId] = useState(ROLES[0].id);
  const targetPolyRef = useRef<SVGPolygonElement>(null);
  const proxyRef = useRef<Record<string, number>>(
    Object.fromEntries(ROLES[0].target.map((value, index) => [`v${index}`, value])),
  );

  const activeRole = ROLES.find((role) => role.id === activeRoleId) ?? ROLES[0];

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      activeRole.target.forEach((value, index) => {
        proxyRef.current[`v${index}`] = value;
      });
      targetPolyRef.current?.setAttribute('points', polygonPoints(activeRole.target));
      return;
    }
    const targets = Object.fromEntries(activeRole.target.map((value, index) => [`v${index}`, value]));
    const tween = gsap.to(proxyRef.current, {
      ...targets,
      duration: 0.75,
      ease: 'power2.inOut',
      onUpdate: () => {
        const values = AXES.map((_, index) => proxyRef.current[`v${index}`]);
        targetPolyRef.current?.setAttribute('points', polygonPoints(values));
      },
    });
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoleId]);

  const gaps = AXES.map((axis, index) => {
    const gap = activeRole.target[index] - CANDIDATE_LEVELS[index];
    const level: GapLevel = gap <= 0 ? 'strong' : gap <= 20 ? 'developing' : 'missing';
    return { axis, gap, level };
  });

  const roadmap = gaps
    .filter((entry) => entry.level !== 'strong')
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  return (
    <Reveal as="div" className="mx-auto max-w-5xl space-y-8 rounded-3xl border border-violet-900/25 bg-[#0d0a16]/60 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="font-mono text-[11px] uppercase tracking-wider text-violet-300">Competency Radar</span>
        <h3 className="text-xl font-bold text-white sm:text-2xl">One resume, three role benchmarks</h3>
        <p className="max-w-xl text-xs text-slate-400 sm:text-sm">
          Pick a target role to morph the benchmark polygon against a candidate&apos;s current evidence — the same fit
          comparison Skill Intelligence runs on a real resume.
        </p>
        <div role="group" aria-label="Target role" className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setActiveRoleId(role.id)}
              aria-pressed={role.id === activeRoleId}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                role.id === activeRoleId
                  ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="mx-auto w-full max-w-sm">
          <svg viewBox="0 0 200 220" className="w-full" role="img" aria-label={`Competency radar comparing current evidence to the ${activeRole.label} benchmark`}>
            <g aria-hidden="true">
              {GRID_RINGS.map((ring) => (
                <polygon
                  key={ring}
                  points={polygonPoints(AXES.map(() => ring * 100))}
                  fill="none"
                  stroke="rgba(148,163,184,0.16)"
                  strokeWidth={0.5}
                />
              ))}
              {AXES.map((_, index) => {
                const [x, y] = axisPoint(index, 100);
                return <line key={index} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="rgba(148,163,184,0.16)" strokeWidth={0.5} />;
              })}
            </g>

            {/* Candidate evidence — cyan, static across role switches */}
            <polygon
              points={polygonPoints(CANDIDATE_LEVELS as unknown as number[])}
              fill="rgba(56,189,248,0.16)"
              stroke="rgba(56,189,248,0.75)"
              strokeWidth={1.5}
            />

            {/* Target role benchmark — violet, morphs via GSAP on role switch */}
            <polygon
              ref={targetPolyRef}
              points={polygonPoints(activeRole.target)}
              fill="rgba(167,139,250,0.14)"
              stroke="rgba(167,139,250,0.85)"
              strokeWidth={1.5}
              strokeDasharray="3,2"
            />

            {AXES.map((axis, index) => {
              const [x, y] = axisPoint(index, 118);
              return (
                <text
                  key={axis}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-400"
                  style={{ fontSize: '7px' }}
                >
                  {axis}
                </text>
              );
            })}
          </svg>
          <div className="mt-2 flex items-center justify-center gap-5 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400" aria-hidden="true" /> Your evidence
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-violet-300 bg-violet-400/40" aria-hidden="true" /> {activeRole.label} benchmark
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {gaps.map((entry) => (
            <div key={entry.axis} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2">
              <span className="text-[11px] text-slate-300">{entry.axis}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${LEVEL_STYLES[entry.level]}`}>
                {entry.level}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-800/60 pt-6">
        <h4 className="text-center text-sm font-semibold text-white">3-stage sprint roadmap</h4>
        {roadmap.length === 0 ? (
          <p className="text-center text-xs text-slate-400">
            This candidate already matches or exceeds every benchmark axis for {activeRole.label}.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {roadmap.map((entry, index) => (
              <div key={entry.axis} className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Sprint {index + 1}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${LEVEL_STYLES[entry.level]}`}>
                    {entry.level}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold text-white">{entry.axis}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{AXIS_ADVICE[entry.axis]}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-center pt-1">
          <Link
            to={isSignedIn ? '/skills' : '/sign-in'}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-300 transition-colors hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            Run this analysis on your real resume
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
