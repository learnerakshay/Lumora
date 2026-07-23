"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileText, Globe2, NotebookTabs, Type, Youtube } from "lucide-react";
import { LumoraLogo } from "@/components/brand/lumora-logo";
import { HeroSourceNode } from "@/components/landing/hero/hero-source-node";

const connections = [
  "M155 236 C230 226 310 276 500 365",
  "M325 124 C365 150 408 238 500 365",
  "M510 100 C500 178 500 260 500 365",
  "M688 124 C648 170 592 254 500 365",
  "M856 238 C764 232 670 275 500 365",
];

const pulsePositions = [
  [155, 236],
  [325, 124],
  [510, 100],
  [688, 124],
  [856, 238],
];

export function LumoraCoreScene() {
  const reducedMotion = useReducedMotion();
  return (
    <div
      aria-label="PDFs, websites, YouTube, notes, and text flowing toward the Lumora Core"
      className="relative mx-auto mt-7 h-[22rem] w-full max-w-5xl overflow-hidden sm:mt-9 sm:h-[27rem] lg:h-[31rem]"
    >
      <div
        aria-hidden
        className="absolute inset-x-[5%] bottom-0 h-[70%] rounded-full bg-[radial-gradient(ellipse_at_center,rgb(124_92_255_/_18%),transparent_62%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[35%] bg-[linear-gradient(180deg,transparent,rgb(23_29_53_/_72%))]"
      />
      <div
        aria-hidden
        className="absolute bottom-[14%] left-[3%] h-24 w-[32%] bg-[#080a13] opacity-80 [clip-path:polygon(0_100%,18%_42%,35%_71%,56%_16%,76%_68%,100%_100%)]"
      />
      <div
        aria-hidden
        className="absolute right-[3%] bottom-[14%] h-24 w-[32%] bg-[#080a13] opacity-80 [clip-path:polygon(0_100%,21%_44%,43%_13%,62%_67%,82%_38%,100%_100%)]"
      />
      <svg
        aria-hidden
        className="absolute inset-x-0 top-[2%] h-[73%] w-full"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 1000 460"
      >
        {connections.map((path, index) => (
          <g key={path}>
            <path d={path} stroke="rgb(178 138 255 / 58%)" strokeWidth="1.25" />
            {!reducedMotion && (
              <motion.path
                animate={{ strokeDashoffset: [28, 0] }}
                d={path}
                stroke="rgb(202 176 255 / 95%)"
                strokeDasharray="3 25"
                strokeWidth="2"
                transition={{
                  duration: 2.8 + index * 0.22,
                  ease: "linear",
                  repeat: Infinity,
                }}
              />
            )}
          </g>
        ))}
        {pulsePositions.map(([cx, cy], index) => (
          <motion.circle
            animate={
              reducedMotion
                ? undefined
                : {
                    opacity: [0, 1, 1, 0],
                    r: [2, 3, 3, 2],
                    x: [0, 500 - cx],
                    y: [0, 365 - cy],
                  }
            }
            cx={cx}
            cy={cy}
            fill="var(--glow)"
            key={`${cx}-${cy}`}
            r="1.5"
            transition={{
              duration: 3.4,
              delay: index * 0.25,
              repeat: Infinity,
            }}
          />
        ))}
      </svg>

      <HeroSourceNode
        className="top-[40%] left-[2%] sm:left-[7%]"
        delay={0}
        icon={FileText}
        label="PDFs"
        mobileClassName="scale-75 sm:scale-100"
        tone="coral"
      />
      <HeroSourceNode
        className="top-[17%] left-[20%] sm:left-[22%]"
        delay={0.16}
        icon={Globe2}
        label="Websites"
        mobileClassName="hidden sm:block"
        tone="cyan"
      />
      <HeroSourceNode
        className="top-[5%] left-1/2 -translate-x-1/2"
        delay={0.28}
        icon={Youtube}
        label="YouTube"
        mobileClassName="scale-75 sm:scale-100"
        tone="coral"
      />
      <HeroSourceNode
        className="top-[17%] right-[18%] sm:right-[22%]"
        delay={0.4}
        icon={NotebookTabs}
        label="Notes"
        mobileClassName="hidden sm:block"
        tone="gold"
      />
      <HeroSourceNode
        className="top-[40%] right-[1%] sm:right-[7%]"
        delay={0.52}
        icon={Type}
        label="Text"
        mobileClassName="scale-75 sm:scale-100"
        tone="violet"
      />

      <motion.div
        animate={reducedMotion ? undefined : { scale: [1, 1.035, 1] }}
        className="absolute bottom-[2%] left-1/2 grid h-40 w-40 -translate-x-1/2 place-items-center rounded-[50%_50%_46%_46%] border border-[#ddc8ff]/58 bg-[radial-gradient(circle_at_40%_23%,rgb(255_255_255_/_18%),rgb(174_132_255_/_38%)_18%,rgb(53_28_103_/_82%)_52%,rgb(9_10_20)_82%)] shadow-[0_12px_38px_rgb(0_0_0_/_48%),0_0_52px_rgb(124_92_255_/_48%),inset_0_0_34px_rgb(255_255_255_/_12%)] sm:h-52 sm:w-52"
        transition={{ duration: 4.6, ease: "easeInOut", repeat: Infinity }}
      >
        <span
          aria-hidden
          className="absolute -inset-7 rounded-full border border-dashed border-[var(--accent)]/35"
        />
        <span
          aria-hidden
          className="absolute -inset-16 rounded-full border border-[var(--accent-cyan)]/15"
        />
        <span
          aria-hidden
          className="absolute -inset-24 hidden rounded-full border border-dashed border-[var(--accent)]/20 sm:block"
        />
        <span
          aria-hidden
          className="absolute inset-3 rounded-[46%] border border-white/15 bg-[linear-gradient(145deg,rgb(255_255_255_/_10%),transparent_38%)]"
        />
        <div className="relative grid justify-items-center gap-2">
          <LumoraLogo className="scale-150" decorative size="lg" />
          <span className="text-sm font-medium tracking-[-0.015em] text-white sm:text-base">
            Lumora Core
          </span>
        </div>
      </motion.div>
    </div>
  );
}
