import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-lg)] border bg-[var(--surface)] shadow-[var(--shadow-raised)]",
        className,
      )}
      {...props}
    />
  );
}
