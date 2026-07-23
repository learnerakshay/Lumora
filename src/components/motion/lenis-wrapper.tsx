"use client";
import Lenis from "lenis";
import { useReducedMotion } from "framer-motion";
import { useEffect, type ReactNode } from "react";

// Opt-in only: use on isolated marketing/presentation pages, never the workspace shell.
export function LenisWrapper({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) return;
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reducedMotion]);
  return <>{children}</>;
}
