"use client";
import { motion, useReducedMotion } from "framer-motion";
import { LumoraMark } from "@/components/brand/lumora-mark";

export function ProcessCore() {
  const reducedMotion = useReducedMotion();
  return (
    <div className="grid justify-items-center gap-5">
      <motion.div
        animate={reducedMotion ? undefined : { scale: [1, 1.025, 1] }}
        transition={{ duration: 4.8, ease: "easeInOut", repeat: Infinity }}
        className="relative mx-auto grid h-48 w-48 place-items-center rounded-full border border-[#e1cfff]/60 bg-[radial-gradient(circle_at_40%_25%,rgb(255_255_255_/_16%),rgb(155_110_255_/_38%)_28%,rgb(18_14_45)_72%)] shadow-[0_0_54px_rgb(124_92_255_/_38%),inset_0_0_30px_rgb(255_255_255_/_10%)]"
      >
        <span
          aria-hidden
          className="absolute -inset-6 rounded-full border border-[var(--accent)]/25"
        />
        <span
          aria-hidden
          className="absolute -inset-17 rounded-full border border-[var(--accent)]/14"
        />
        <span
          aria-hidden
          className="absolute -inset-12 rounded-full border border-dashed border-[var(--accent-cyan)]/15"
        />
        <div className="relative grid justify-items-center gap-2">
          <LumoraMark className="h-16 w-16" decorative />
          <span className="text-sm font-medium text-white">Lumora Core</span>
        </div>
      </motion.div>
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/35 bg-[var(--surface)]/70 px-4 py-2 text-xs text-white/85">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        Understanding Layer
      </span>
    </div>
  );
}
