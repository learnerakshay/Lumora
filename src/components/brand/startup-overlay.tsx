"use client";

import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { LumoraLogo } from "@/components/brand/lumora-logo";

gsap.registerPlugin(useGSAP);

export function StartupOverlay() {
  const root = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  useGSAP(
    () => {
      const done = () => setVisible(false);
      if (reducedMotion) {
        gsap.to(root.current, {
          opacity: 0,
          duration: 0.16,
          delay: 0.12,
          onComplete: done,
        });
        return;
      }
      gsap
        .timeline({ onComplete: done })
        .from("[data-startup-dot]", {
          opacity: 0,
          scale: 0.35,
          duration: 0.18,
          ease: "power2.out",
        })
        .from(
          "[data-startup-ring]",
          {
            opacity: 0,
            scale: 0.76,
            duration: 0.22,
            stagger: 0.1,
            ease: "power2.out",
          },
          "-=0.03",
        )
        .to("[data-startup-mark]", {
          scale: 1.03,
          duration: 0.18,
          ease: "sine.inOut",
        })
        .to("[data-startup-mark]", {
          scale: 1,
          duration: 0.2,
          ease: "sine.inOut",
        })
        .to(
          "[data-startup-wordmark]",
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
          "-=0.1",
        )
        .to(root.current, {
          opacity: 0,
          duration: 0.28,
          delay: 0.12,
          ease: "power1.out",
        });
    },
    { scope: root, dependencies: [reducedMotion] },
  );
  useEffect(() => {
    const fallback = window.setTimeout(() => setVisible(false), 2200);
    return () => window.clearTimeout(fallback);
  }, []);
  if (!visible) return null;
  return (
    <div
      aria-label="Opening Lumora"
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center bg-[var(--backdrop)]"
      ref={root}
      role="status"
    >
      <div className="grid justify-items-center gap-4">
        <div
          data-startup-mark
          className="relative grid h-16 w-16 place-items-center"
        >
          <span
            data-startup-ring
            className="absolute h-16 w-16 rounded-full border border-[var(--accent-cyan)]/20"
          />
          <span
            data-startup-ring
            className="absolute h-11 w-11 rounded-full border border-[var(--accent)]/35"
          />
          <span
            data-startup-ring
            className="absolute h-6 w-6 rounded-full border border-[var(--glow)]/60"
          />
          <span
            data-startup-dot
            className="h-2.5 w-2.5 rounded-full bg-[var(--glow)] shadow-[0_0_18px_var(--glow)]"
          />
        </div>
        <div data-startup-wordmark className="translate-y-1 opacity-0">
          <LumoraLogo decorative size="sm" wordmark />
        </div>
      </div>
    </div>
  );
}
