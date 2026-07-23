import { useId } from "react";

export type LumoraMarkProps = {
  animated?: boolean;
  className?: string;
  decorative?: boolean;
};

export function LumoraMark({
  animated = false,
  className,
  decorative = false,
}: LumoraMarkProps) {
  const id = useId();
  const group = (name: "star" | "a-mark" | "outer-arc") =>
    animated
      ? { [`data-startup-${name}`]: "", id: `lumora-${name}` }
      : { className: `lumora-${name}` };
  return (
    <svg
      aria-hidden={decorative}
      aria-label={decorative ? undefined : "Lumora"}
      className={className}
      fill="none"
      role={decorative ? undefined : "img"}
      viewBox="0 0 160 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={`${id}-gradient`}
          x1="36"
          x2="126"
          y1="32"
          y2="136"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="42%" stopColor="#E9DFFF" />
          <stop offset="72%" stopColor="#BFA6FF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0.65 0 0 0 0.35 0 0.45 0 0 0.18 0 0 1 0 0.45 0 0 0 0.55 0"
            result="coloredBlur"
          />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g {...group("star")} filter={`url(#${id}-glow)`}>
        <path
          d="M80 20 C82 29 87 34 96 36 C87 38 82 43 80 52 C78 43 73 38 64 36 C73 34 78 29 80 20Z"
          fill={`url(#${id}-gradient)`}
        />
      </g>
      <g
        {...group("a-mark")}
        filter={`url(#${id}-glow)`}
        stroke={`url(#${id}-gradient)`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="11"
      >
        <path
          data-startup-a-stroke={animated ? "" : undefined}
          d="M42 128 C54 105 65 91 80 76 C95 91 106 105 118 128"
        />
        <path
          data-startup-a-stroke={animated ? "" : undefined}
          d="M61 128 C68 113 74 103 80 96 C86 103 92 113 99 128"
        />
      </g>
      <g
        {...group("outer-arc")}
        fill="none"
        filter={`url(#${id}-glow)`}
        stroke={`url(#${id}-gradient)`}
        strokeLinecap="round"
        strokeWidth="11"
      >
        <path
          data-startup-outer-stroke={animated ? "" : undefined}
          d="M25 105 C27 61 50 38 80 38 C110 38 133 61 135 105"
        />
      </g>
    </svg>
  );
}
