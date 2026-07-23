"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

type HeroSourceNodeProps = {
  delay: number;
  icon: LucideIcon;
  label: string;
  mobileClassName: string;
  tone: "cyan" | "coral" | "gold" | "violet";
  className: string;
};

const tones = {
  cyan: "text-[var(--accent-cyan)]",
  coral: "text-[#ff8290]",
  gold: "text-[#f4c86d]",
  violet: "text-[#b28aff]",
};

export function HeroSourceNode({
  className,
  delay,
  icon: Icon,
  label,
  mobileClassName,
  tone,
}: HeroSourceNodeProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      animate={reducedMotion ? undefined : { y: [0, -7, 0] }}
      className={`absolute ${className} ${mobileClassName}`}
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      transition={
        reducedMotion
          ? undefined
          : {
              opacity: { duration: 0.5, delay },
              y: { duration: 4.8, delay, ease: "easeInOut", repeat: Infinity },
            }
      }
    >
      <div className="grid h-[6.8rem] w-[6.8rem] place-items-center rounded-[1.25rem] border border-white/15 bg-[linear-gradient(145deg,rgb(18_23_37_/_95%),rgb(10_13_24_/_92%))] shadow-[0_16px_34px_rgb(0_0_0_/_28%)] backdrop-blur-sm sm:h-[7.6rem] sm:w-[7.6rem]">
        <div className="grid justify-items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <Icon
            aria-hidden
            className={tones[tone]}
            size={27}
            strokeWidth={1.65}
          />
          <span>{label}</span>
        </div>
      </div>
    </motion.div>
  );
}
