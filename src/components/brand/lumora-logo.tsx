import { cn } from "@/lib/utils";

type LumoraLogoProps = {
  className?: string;
  decorative?: boolean;
  size?: "sm" | "md" | "lg";
  wordmark?: boolean;
};

const sizes = { sm: 24, md: 32, lg: 48 };

export function LumoraLogo({
  className,
  decorative = false,
  size = "md",
  wordmark = false,
}: LumoraLogoProps) {
  const iconSize = sizes[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        aria-hidden={decorative}
        aria-label={decorative ? undefined : "Lumora"}
        className="shrink-0"
        fill="none"
        height={iconSize}
        role={decorative ? undefined : "img"}
        viewBox="0 0 48 48"
        width={iconSize}
      >
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="var(--accent-cyan)"
          strokeOpacity=".16"
        />
        <circle
          cx="24"
          cy="24"
          r="14"
          stroke="var(--accent)"
          strokeOpacity=".34"
        />
        <circle
          cx="24"
          cy="24"
          r="8"
          stroke="var(--glow)"
          strokeOpacity=".58"
        />
        <circle cx="24" cy="24" fill="var(--glow)" r="3" />
      </svg>
      {wordmark && (
        <span className="text-[1.05rem] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
          Lumora
        </span>
      )}
    </span>
  );
}
