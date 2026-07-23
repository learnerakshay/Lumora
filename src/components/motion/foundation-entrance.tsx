"use client";
import { useGSAP } from "@gsap/react";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { Sparkles } from "lucide-react";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

export function FoundationEntrance() {
  const root = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  useGSAP(
    () => {
      if (!reducedMotion)
        gsap.from("[data-foundation-mark]", {
          opacity: 0,
          y: 8,
          duration: 0.45,
          ease: "power2.out",
        });
    },
    { scope: root, dependencies: [reducedMotion] },
  );
  return (
    <section
      ref={root}
      className="w-full rounded-[var(--radius)] border bg-[var(--card)] p-8"
    >
      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <Sparkles aria-hidden className="mb-5 text-[var(--accent)]" />
        <p
          data-foundation-mark
          className="text-sm font-medium text-[var(--accent)]"
        >
          Lumora · Phase 1
        </p>
        <h1
          data-foundation-mark
          className="mt-2 text-3xl font-semibold tracking-tight"
        >
          Foundation ready for learning research.
        </h1>
        <p data-foundation-mark className="mt-4 max-w-xl text-[var(--muted)]">
          The application shell, quality tooling, and integration boundaries are
          in place. Product workflows intentionally begin in a later phase.
        </p>
      </motion.div>
    </section>
  );
}
