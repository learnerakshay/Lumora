"use client";
import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";

// Opt-in only: use on isolated marketing/presentation pages, never the workspace shell.
export function LenisWrapper({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis();
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
  }, []);
  return <>{children}</>;
}
