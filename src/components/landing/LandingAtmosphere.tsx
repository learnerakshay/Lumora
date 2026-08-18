import React, { useEffect, useRef } from 'react';

interface DataParticle {
  left: number;
  top: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
}

// A sparse, viewport-fixed field of tiny cyan "data" points — deliberately
// generated once at module load (not per-render) so positions stay stable
// for the life of the tab. Deterministic seeding isn't required: this is
// pure ambience, never asserted on by tests, and never re-mounted mid-session.
const PARTICLE_COUNT = 34;
const PARTICLES: DataParticle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
  left: Math.random() * 100,
  top: Math.random() * 100,
  size: 1 + Math.random() * 2.2,
  opacity: 0.18 + Math.random() * 0.42,
  duration: 9 + Math.random() * 10,
  delay: -(Math.random() * 12),
  drift: 6 + Math.random() * 14,
}));

// A handful of faint traces connecting nearby particles — evidence/data
// "system activity", not a starfield. Fixed, hand-placed pairs rather than
// a computed nearest-neighbor graph, so the effect stays deliberately sparse.
const TRACES = [
  { x1: 12, y1: 18, x2: 26, y2: 30 },
  { x1: 68, y1: 12, x2: 82, y2: 22 },
  { x1: 20, y1: 68, x2: 34, y2: 58 },
  { x1: 74, y1: 70, x2: 60, y2: 80 },
];

interface LandingAtmosphereProps {
  /** AuthWelcomeBoard reuses this component for its base gradient but
   * layers its own denser AuthStarField canvas on top — set false there so
   * the two particle systems never double up. Defaults to true (landing
   * page usage). */
  particles?: boolean;
}

export function LandingAtmosphere({ particles = true }: LandingAtmosphereProps) {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!particles) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let latestX = 0;
    let latestY = 0;
    const apply = () => {
      raf = 0;
      fieldRef.current?.style.setProperty('--atmosphere-x', `${latestX}px`);
      fieldRef.current?.style.setProperty('--atmosphere-y', `${latestY}px`);
    };
    const onPointerMove = (event: PointerEvent) => {
      latestX = (event.clientX / window.innerWidth - 0.5) * 10;
      latestY = (event.clientY / window.innerHeight - 0.5) * 8;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(14,165,233,0.075),transparent_34rem),radial-gradient(circle_at_72%_54%,rgba(6,182,212,0.035),transparent_30rem),#070b12]" />
      {particles && (
        <div
          ref={fieldRef}
          className="landing-data-field absolute inset-[-4%]"
          style={{ transform: 'translate3d(var(--atmosphere-x, 0px), var(--atmosphere-y, 0px), 0)' }}
        >
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none">
            {TRACES.map((trace, index) => (
              <line
                key={index}
                x1={`${trace.x1}%`}
                y1={`${trace.y1}%`}
                x2={`${trace.x2}%`}
                y2={`${trace.y2}%`}
                className="landing-data-trace"
                style={{ '--trace-delay': `${index * -2.6}s` } as React.CSSProperties}
              />
            ))}
          </svg>
          {PARTICLES.map((particle, index) => (
            <span
              key={index}
              className="landing-data-star"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                '--star-opacity': particle.opacity,
                '--star-duration': `${particle.duration}s`,
                '--star-delay': `${particle.delay}s`,
                '--star-drift': `${particle.drift}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
}
