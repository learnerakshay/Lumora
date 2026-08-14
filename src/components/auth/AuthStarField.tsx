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

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="auth-star-field pointer-events-none absolute inset-0 z-[1]" />;
}
