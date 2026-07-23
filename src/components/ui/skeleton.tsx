import { cn } from "@/lib/utils";
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-[var(--radius-sm)] bg-[var(--skeleton)]",
        className,
      )}
    />
  );
}
