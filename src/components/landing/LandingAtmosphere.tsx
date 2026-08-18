import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from './motion/useReducedMotion';

interface Star {
  x: number;
  baseY: number;
  radius: number;
  baseAlpha: number;
  color: 'white' | 'cyan';
  layer: 0 | 1 | 2;
  phase: number;
  period: number;
  bloomStartedAt: number | null;
}

// Parallax multipliers per depth layer — read against window.scrollY inside
// the rAF loop, never via a scroll listener that calls setState.
const LAYER_PARALLAX = [0.02, 0.05, 0.09] as const;
const BLOOM_DURATION_S = 2.4;
const BLOOM_CHECK_INTERVAL_MS = 4000;
// ~2.5 blooms/minute across the whole field, checked every 4s.
const BLOOM_PROBABILITY_PER_CHECK = 0.17;

function createStars(width: number, height: number, count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    baseY: Math.random() * height,
    radius: 0.4 + Math.random() * 0.9,
    baseAlpha: 0.08 + Math.random() * 0.27,
    color: Math.random() < 0.72 ? 'white' : 'cyan',
    layer: Math.floor(Math.random() * 3) as 0 | 1 | 2,
    phase: Math.random() * Math.PI * 2,
    period: 2.5 + Math.random() * 3.5,
    bloomStartedAt: null,
  }));
}

function starColor(star: Star, alpha: number): string {
  return star.color === 'white' ? `rgba(255,255,255,${alpha})` : `rgba(125,211,252,${alpha})`;
}

interface LandingAtmosphereProps {
  /** AuthWelcomeBoard reuses this component for its base gradient but
   * layers its own denser AuthStarField canvas on top — set false there so
   * the two particle systems never double up. Defaults to true (landing
   * page usage). */
  particles?: boolean;
}

export function LandingAtmosphere({ particles = true }: LandingAtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!particles) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frame = 0;
    let pageVisible = document.visibilityState === 'visible';
    let lastBloomCheck = performance.now();
    const clockStart = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = width < 768 ? 40 : 90;
      stars = createStars(width, height, count);
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x, star.baseY, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = starColor(star, star.baseAlpha);
        ctx.fill();
      });
    };

    const maybeTriggerBloom = (now: number) => {
      if (now - lastBloomCheck < BLOOM_CHECK_INTERVAL_MS) return;
      lastBloomCheck = now;
      if (width < 768) return; // no bloom events on mobile
      if (Math.random() >= BLOOM_PROBABILITY_PER_CHECK || stars.length === 0) return;
      const candidate = stars[Math.floor(Math.random() * stars.length)];
      if (candidate.bloomStartedAt === null) candidate.bloomStartedAt = now;
    };

    const draw = (now: number) => {
      const elapsedSeconds = (now - clockStart) / 1000;
      const scrollY = window.scrollY;
      ctx.clearRect(0, 0, width, height);
      stars.forEach((star) => {
        const twinkle = Math.sin((elapsedSeconds * (Math.PI * 2)) / star.period + star.phase);
        let alpha = star.baseAlpha * (1 + twinkle * 0.35);
        let radius = star.radius;

        if (star.bloomStartedAt !== null) {
          const bloomElapsed = (now - star.bloomStartedAt) / 1000;
          const bloomProgress = Math.min(1, bloomElapsed / BLOOM_DURATION_S);
          const bloomCurve = Math.sin(bloomProgress * Math.PI);
          alpha = Math.min(1, alpha + bloomCurve * 0.5);
          radius = star.radius * (1 + bloomCurve * 2.2);
          if (bloomProgress >= 1) star.bloomStartedAt = null;
        }

        const parallaxOffset = scrollY * LAYER_PARALLAX[star.layer];
        const y = (((star.baseY + parallaxOffset) % height) + height) % height;

        ctx.beginPath();
        ctx.arc(star.x, y, Math.max(0.2, radius), 0, Math.PI * 2);
        ctx.fillStyle = starColor(star, Math.min(1, alpha));
        ctx.fill();
      });
    };

    const loop = (now: number) => {
      if (!pageVisible) return;
      maybeTriggerBloom(now);
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    if (reducedMotion) {
      drawStatic();
    } else {
      frame = requestAnimationFrame(loop);
    }

    const handleVisibility = () => {
      pageVisible = document.visibilityState === 'visible';
      if (pageVisible && !reducedMotion) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [particles, reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(14,165,233,0.075),transparent_34rem),radial-gradient(circle_at_72%_54%,rgba(6,182,212,0.035),transparent_30rem),#070b12]"
    >
      {particles && <canvas ref={canvasRef} className="absolute inset-0" />}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.4) 100%)' }}
      />
    </div>
  );
}
