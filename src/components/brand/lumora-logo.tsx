import { cn } from "@/lib/utils";
import { LumoraMark } from "@/components/brand/lumora-mark";

type LumoraLogoProps = {
  animated?: boolean;
  className?: string;
  decorative?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  wordmark?: boolean;
};
const sizes = { sm: 24, md: 32, lg: 48, xl: 144 };
export function LumoraLogo({
  animated = false,
  className,
  decorative = false,
  size = "md",
  wordmark = false,
}: LumoraLogoProps) {
  const iconSize = sizes[size];
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className="shrink-0" style={{ height: iconSize, width: iconSize }}>
        <LumoraMark
          animated={animated}
          className="h-full w-full"
          decorative={decorative}
        />
      </span>
      {wordmark && (
        <span className="relative top-px text-[1.05rem] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
          Lumora
        </span>
      )}
    </span>
  );
}
