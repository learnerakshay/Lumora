"use client";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  FileText,
  Globe2,
  MessageCircle,
  Network,
  NotebookTabs,
  Podcast,
  Route,
  Type,
  Youtube,
} from "lucide-react";
import { LumoraMark } from "@/components/brand/lumora-mark";
const sources = [
  [FileText, "PDFs"],
  [Globe2, "Websites"],
  [Youtube, "YouTube"],
  [NotebookTabs, "Notes"],
  [Type, "Text"],
] as const;
const outputs = [
  [MessageCircle, "AI Conversations"],
  [BookOpen, "Source Insights"],
  [BookOpen, "Study Guides"],
  [Network, "Flashcards"],
  [Podcast, "Podcasts"],
  [Route, "Learning Roadmaps"],
] as const;
const concepts = [
  "Context",
  "Ideas",
  "Sources",
  "Learning",
  "Insights",
  "Memory",
  "Links",
];
export function LivingKnowledgeDiagram() {
  const reduced = useReducedMotion();
  return (
    <div
      aria-label="Sources flow through Lumora Core and Understanding Layer into a Knowledge Graph and learning outputs"
      className="relative mx-auto mt-12 min-h-[42rem] max-w-4xl overflow-hidden lg:mt-0"
    >
      <svg
        aria-hidden
        className="absolute inset-0 hidden h-full w-full lg:block"
        viewBox="0 0 800 580"
      >
        {[
          "M105 100 C190 120 220 230 315 285",
          "M105 190 C190 200 230 250 315 290",
          "M105 280 C190 280 230 280 315 290",
          "M105 370 C190 360 230 320 315 295",
          "M105 460 C190 430 230 340 315 300",
          "M430 292 C485 292 510 280 555 275",
          "M610 275 C670 210 690 130 760 105",
          "M610 285 C680 275 700 200 760 195",
          "M610 295 C680 300 700 285 760 285",
          "M610 305 C680 330 700 375 760 375",
          "M610 315 C680 370 700 465 760 465",
          "M610 325 C680 410 700 535 760 555",
        ].map((d, i) => (
          <g key={d}>
            <path d={d} stroke="rgb(191 166 255 / 35%)" strokeWidth="1.2" />
            {!reduced && (
              <motion.path
                animate={{ strokeDashoffset: [24, 0] }}
                d={d}
                stroke="rgb(233 223 255 / 85%)"
                strokeDasharray="3 21"
                strokeWidth="1.8"
                transition={{
                  duration: 3.6,
                  delay: i * 0.17,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            )}
          </g>
        ))}
      </svg>
      <div className="relative grid gap-5 lg:grid-cols-[8rem_14rem_1fr_11rem] lg:items-center">
        <div className="grid gap-2">
          {sources.map(([Icon, label]) => (
            <div
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-2.5 py-2 text-xs text-white"
              key={label}
            >
              <Icon aria-hidden size={15} className="text-[#c9b0ff]" />
              {label}
            </div>
          ))}
        </div>
        <div className="grid justify-items-center gap-4">
          <motion.div
            animate={reduced ? undefined : { scale: [1, 1.025, 1] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="grid h-40 w-40 place-items-center rounded-full border border-[#dac7ff]/55 bg-[radial-gradient(circle,rgb(156_110_255_/_40%),rgb(16_12_39)_68%)] shadow-[0_0_42px_rgb(124_92_255_/_32%)]"
          >
            <div className="grid justify-items-center gap-2">
              <LumoraMark decorative className="h-14 w-14" />
              <span className="text-xs text-white">Lumora Core</span>
            </div>
          </motion.div>
          <span className="rounded-full border border-[var(--accent)]/35 px-3 py-1 text-xs text-white/85">
            Understanding Layer
          </span>
        </div>
        <div className="relative hidden h-72 lg:block">
          {concepts.map((name, i) => (
            <span
              className="absolute grid h-11 w-11 place-items-center rounded-full border border-[#c9b0ff]/35 bg-[#141329] text-[.56rem] text-white"
              key={name}
              style={{
                left: ["8%", "49%", "74%", "60%", "18%", "38%", "82%"][i],
                top: ["18%", "4%", "30%", "68%", "70%", "42%", "83%"][i],
              }}
            >
              {name}
            </span>
          ))}
          <p className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-[var(--text-secondary)]">
            Knowledge Graph
          </p>
        </div>
        <div className="grid gap-2">
          {outputs.map(([Icon, label]) => (
            <div
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-2.5 py-2 text-xs text-white"
              key={label}
            >
              <Icon aria-hidden size={14} className="text-[#c9b0ff]" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
