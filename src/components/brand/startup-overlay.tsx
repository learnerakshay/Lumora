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
          duration: 0.2,
          delay: 2.8,
          onComplete: done,
        });
        return;
      }

      gsap
        .timeline({ onComplete: done })
        .fromTo(
          "[data-startup-star]",
          { opacity: 0, scale: 0.55, transformOrigin: "50% 50%" },
          {
            opacity: 1,
            scale: 1,
            duration: 0.7,
            ease: "power2.out",
          },
        )
        .fromTo(
          "[data-startup-a-stroke]",
          {
            opacity: 0.45,
            strokeDasharray: 100,
            strokeDashoffset: 100,
            y: 6,
          },
          {
            opacity: 1,
            strokeDashoffset: 0,
            y: 0,
            duration: 0.7,
            ease: "power2.out",
          },
        )
        .fromTo(
          "[data-startup-outer-stroke]",
          { strokeDasharray: 100, strokeDashoffset: 100, opacity: 0.5 },
          {
            strokeDashoffset: 0,
            opacity: 1,
            duration: 0.7,
            ease: "power1.inOut",
          },
        )
        .to("[data-startup-star]", {
          filter: "drop-shadow(0 0 8px rgb(184 245 255 / 55%))",
          duration: 0.3,
          ease: "sine.inOut",
        })
        .to(root.current, {
          opacity: 0,
          duration: 0.15,
          delay: 0.45,
          ease: "power1.out",
        });
    },
    { scope: root, dependencies: [reducedMotion] },
  );

  useEffect(() => {
    const fallback = window.setTimeout(() => setVisible(false), 4200);
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
      <LumoraLogo animated decorative size="xl" />
    </div>
  );
}
