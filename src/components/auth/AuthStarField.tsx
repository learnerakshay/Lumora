import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  phase: number;
  speed: number;
  drift: number;
}

interface SparkBurst {
  x: number;
  y: number;
  startedAt: number;
}

function createStars(width: number, height: number, count: number): Star[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = index + 1;
    return {
      x: (((seed * 83.17) % 100) / 100) * width,
      y: (((seed * 47.63) % 100) / 100) * height,
      radius: 0.45 + ((seed * 0.37) % 1) * 0.9,
      opacity: 0.12 + ((seed * 0.19) % 1) * 0.28,
      phase: (seed * 1.73) % (Math.PI * 2),
      speed: 0.12 + ((seed * 0.11) % 1) * 0.16,
      drift: -0.7 + ((seed * 0.29) % 1) * 1.4,
    };
  });
}

export function AuthStarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let pointerActive = false;
    let pointerX = -1000;
    let pointerY = -1000;
    let bursts: SparkBurst[] = [];

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const density = width < 640 ? 42 : Math.min(86, Math.round((width * height) / 18000));
      stars = createStars(width, height, density);
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      const elapsed = time / 1000;

      stars.forEach((star) => {
        const driftX = reducedMotion ? 0 : Math.sin(elapsed * star.speed + star.phase) * star.drift;
        const driftY = reducedMotion ? 0 : ((elapsed * star.speed * 1.4 + star.y) % (height + 12)) - star.y - 6;
        let x = star.x + driftX;
        let y = star.y + driftY;
        let proximity = 0;

        if (pointerActive) {
          const dx = x - pointerX;
          const dy = y - pointerY;
          const distance = Math.hypot(dx, dy);
          proximity = Math.max(0, 1 - distance / 118);
          if (distance > 0) {
            x += (dx / distance) * proximity * 1.8;
            y += (dy / distance) * proximity * 1.8;
          }
        }

        const twinkle = reducedMotion ? 0 : Math.sin(elapsed * (0.65 + star.speed) + star.phase) * 0.07;
        context.beginPath();
        context.arc(x, y, star.radius + proximity * 0.35, 0, Math.PI * 2);
        context.fillStyle = `rgba(125, 211, 252, ${Math.max(0.06, star.opacity + twinkle + proximity * 0.38)})`;
        context.fill();
      });

      bursts = bursts.filter((burst) => {
        const progress = (time - burst.startedAt) / 760;
        if (progress >= 1) return false;

        const eased = 1 - Math.pow(1 - Math.max(0, progress), 3);
        const alpha = (1 - eased) * 0.42;
        context.beginPath();
        context.arc(burst.x, burst.y, 8 + eased * 34, 0, Math.PI * 2);
        context.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        context.lineWidth = 1;
        context.stroke();

        for (let index = 0; index < 6; index += 1) {
          const angle = (index / 6) * Math.PI * 2 + Math.PI / 6;
          const distance = 6 + eased * (15 + (index % 2) * 5);
          const x = burst.x + Math.cos(angle) * distance;
          const y = burst.y + Math.sin(angle) * distance;
          context.beginPath();
          context.arc(x, y, 1.25 * (1 - eased * 0.55), 0, Math.PI * 2);
          context.fillStyle = `rgba(125, 211, 252, ${(1 - eased) * 0.7})`;
          context.fill();
        }
        return true;
      });
    };

    const animate = (time: number) => {
      draw(time);
      frame = window.requestAnimationFrame(animate);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!hasFinePointer || reducedMotion) return;
      const target = event.target;
      if (target instanceof Element && target.closest('.auth-board')) {
        pointerActive = false;
        return;
      }
      const rect = container.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      pointerActive = true;
    };

    const onPointerLeave = () => {
      pointerActive = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (reducedMotion) return;
      const target = event.target;
      if (target instanceof Element && target.closest('.auth-board')) return;
      const rect = container.getBoundingClientRect();
      bursts.push({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        startedAt: performance.now(),
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw();
    });
    resizeObserver.observe(container);
    resize();

    if (reducedMotion) draw();
    else frame = window.requestAnimationFrame(animate);

    if (hasFinePointer && !reducedMotion) {
      container.addEventListener('pointermove', onPointerMove, { passive: true });
      container.addEventListener('pointerleave', onPointerLeave, { passive: true });
    }
    if (!reducedMotion) container.addEventListener('pointerdown', onPointerDown, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="auth-star-field pointer-events-none absolute inset-0 z-[1]" />;
}
