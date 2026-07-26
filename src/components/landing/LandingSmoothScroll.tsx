import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let activeLenis: Lenis | null = null;

export function scrollToLandingSection(element: HTMLElement) {
  if (activeLenis) {
    activeLenis.scrollTo(element, {
      offset: -76,
      duration: 1.05,
    });
    return;
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function LandingSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.08,
      easing: (time) => Math.min(1, 1.001 - Math.pow(2, -10 * time)),
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.05,
      wheelMultiplier: 0.9,
      anchors: { offset: -76 },
      stopInertiaOnNavigate: true,
    });
    activeLenis = lenis;

    const syncScrollTrigger = () => ScrollTrigger.update();
    const tick = (time: number) => lenis.raf(time * 1000);

    lenis.on('scroll', syncScrollTrigger);
    gsap.ticker.add(tick);
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(tick);
      lenis.off('scroll', syncScrollTrigger);
      lenis.destroy();
      if (activeLenis === lenis) activeLenis = null;
    };
  }, []);

  return null;
}
