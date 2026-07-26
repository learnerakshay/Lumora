import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  depth: number;
  speed: number;
  phase: number;
}

export function LandingAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const mobile = window.innerWidth < 768;
    const particles: Particle[] = Array.from(
      { length: reducedMotion ? 26 : mobile ? 42 : 78 },
      (_, index) => ({
        x: Math.random(),
        y: Math.random(),
        depth: 0.35 + Math.random() * 0.65,
        speed: 0.00005 + Math.random() * 0.00012,
        phase: index * 0.73 + Math.random() * Math.PI,
      }),
    );

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let active = true;
    let lastTime = performance.now();
    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const render = (time: number) => {
      if (!active) return;
      const delta = Math.min(32, time - lastTime);
      lastTime = time;
      context.clearRect(0, 0, width, height);

      const documentHeight = Math.max(
        document.documentElement.scrollHeight - height,
        1,
      );
      const scrollProgress = Math.min(1, window.scrollY / documentHeight);
      const convergence = Math.sin(scrollProgress * Math.PI);
      const heroBottom =
        document.getElementById('overview')?.getBoundingClientRect().bottom ??
        -height;
      const transitionStrength = Math.max(
        0,
        1 - Math.abs(heroBottom - height * 0.48) / (height * 0.82),
      );
      pointerX += (targetPointerX - pointerX) * 0.035;
      pointerY += (targetPointerY - pointerY) * 0.035;

      const aurora = context.createRadialGradient(
        width * (0.48 + scrollProgress * 0.06),
        height * 0.42,
        0,
        width * 0.5,
        height * 0.45,
        Math.max(width, height) * 0.72,
      );
      aurora.addColorStop(0, `rgba(14,165,233,${0.06 + convergence * 0.025})`);
      aurora.addColorStop(0.38, 'rgba(6,182,212,0.025)');
      aurora.addColorStop(1, 'rgba(2,6,23,0)');
      context.fillStyle = aurora;
      context.fillRect(0, 0, width, height);

      if (transitionStrength > 0.01) {
        const streamCount = mobile ? 7 : 13;
        context.save();
        context.globalCompositeOperation = 'lighter';
        for (let index = 0; index < streamCount; index += 1) {
          const ratio = index / (streamCount - 1);
          const startX = ratio * width;
          const startY =
            height * (0.25 + Math.abs(ratio - 0.5) * 0.18) +
            Math.sin(time * 0.00035 + index * 0.8) * 12;
          const endX =
            width * 0.5 +
            Math.sin(time * 0.00024 + index * 1.7) * width * 0.012;
          const endY = height * 0.92;
          const controlX =
            width * 0.5 + (ratio - 0.5) * width * 0.16;
          const controlY = height * 0.62;

          context.beginPath();
          context.moveTo(startX, startY);
          context.quadraticCurveTo(controlX, controlY, endX, endY);
          context.lineWidth =
            (index % 3 === 0 ? 1.1 : 0.55) * transitionStrength;
          context.strokeStyle = `rgba(14,165,233,${
            (0.045 + (index % 4) * 0.012) * transitionStrength
          })`;
          context.stroke();

          if (!reducedMotion) {
            const travel =
              (time * (0.0001 + (index % 4) * 0.000012) + index * 0.083) %
              1;
            const inverse = 1 - travel;
            const particleX =
              inverse * inverse * startX +
              2 * inverse * travel * controlX +
              travel * travel * endX;
            const particleY =
              inverse * inverse * startY +
              2 * inverse * travel * controlY +
              travel * travel * endY;
            context.beginPath();
            context.arc(
              particleX,
              particleY,
              0.8 + transitionStrength,
              0,
              Math.PI * 2,
            );
            context.fillStyle = `rgba(125,211,252,${
              0.25 * transitionStrength
            })`;
            context.fill();
          }
        }
        context.restore();
      }

      const points = particles.map((particle, index) => {
        if (!reducedMotion) {
          particle.y += particle.speed * delta * particle.depth;
          particle.x +=
            Math.sin(time * 0.00008 + particle.phase) *
            0.000015 *
            delta;
          if (particle.y > 1.04) {
            particle.y = -0.04;
            particle.x = Math.random();
          }
        }
        const centerPull =
          convergence * 0.055 * Math.sin(particle.y * Math.PI);
        const depthShift = particle.depth - 0.25;
        const x =
          (particle.x + (0.5 - particle.x) * centerPull) * width +
          pointerX * depthShift * 14;
        const y = particle.y * height + pointerY * depthShift * 10;
        const twinkle = reducedMotion
          ? 0.55
          : 0.38 + Math.sin(time * 0.0012 + particle.phase) * 0.22;
        const radius = 0.55 + particle.depth * 1.05;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(56,189,248,${Math.max(0.12, twinkle)})`;
        context.fill();
        return { x, y, depth: particle.depth, index };
      });

      if (!mobile && !reducedMotion) {
        context.lineWidth = 0.55;
        for (let index = 0; index < points.length; index += 1) {
          const first = points[index];
          for (let nextIndex = index + 1; nextIndex < points.length; nextIndex += 1) {
            const second = points[nextIndex];
            const dx = first.x - second.x;
            const dy = first.y - second.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 105) continue;
            context.beginPath();
            context.moveTo(first.x, first.y);
            context.lineTo(second.x, second.y);
            context.strokeStyle = `rgba(14,165,233,${
              (1 - distance / 105) * 0.055 * convergence
            })`;
            context.stroke();
          }
        }
      }

      if (!reducedMotion) frame = requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      active = document.visibilityState === 'visible';
      if (active && !reducedMotion) {
        lastTime = performance.now();
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(render);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (mobile || reducedMotion) return;
      const hero = document.getElementById('overview');
      if (!hero) return;
      const bounds = hero.getBoundingClientRect();
      if (bounds.bottom <= 0 || bounds.top >= height) return;
      targetPointerX = ((event.clientX / width) - 0.5) * 2;
      targetPointerY = ((event.clientY / height) - 0.5) * 2;
    };

    const handlePointerLeave = () => {
      targetPointerX = 0;
      targetPointerY = 0;
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibility);
    if (reducedMotion) render(performance.now());
    else frame = requestAnimationFrame(render);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen opacity-90"
    />
  );
}
