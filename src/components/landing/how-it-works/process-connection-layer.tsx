"use client";
import { motion, useReducedMotion } from "framer-motion";
const paths = [
  "M10 92 C110 92 148 132 238 132",
  "M238 132 C330 132 366 92 490 92",
];
export function ProcessConnectionLayer() {
  const reduced = useReducedMotion();
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-40 w-full -translate-y-1/2 lg:block"
      fill="none"
      viewBox="0 0 500 180"
    >
      {paths.map((d, i) => (
        <g key={d}>
          <path d={d} stroke="rgb(191 166 255 / 38%)" strokeWidth="1.4" />
          {!reduced && (
            <motion.path
              animate={{ strokeDashoffset: [28, 0] }}
              d={d}
              stroke="rgb(233 223 255 / 90%)"
              strokeDasharray="3 25"
              strokeWidth="2"
              transition={{
                duration: 3,
                delay: i * 0.7,
                ease: "linear",
                repeat: Infinity,
              }}
            />
          )}
        </g>
      ))}
    </svg>
  );
}
