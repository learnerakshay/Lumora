import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LandingContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl px-[var(--page-gutter)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
export function LandingSection({
  children,
  className,
  id,
  label,
  title,
}: {
  children?: ReactNode;
  className?: string;
  id?: string;
  label: string;
  title: string;
}) {
  return (
    <section className={cn("border-t py-20 sm:py-28", className)} id={id}>
      <LandingContainer>
        <p className="text-xs font-medium tracking-[0.14em] text-[var(--muted)] uppercase">
          {label}
        </p>
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
          {title}
        </h2>
        {children}
      </LandingContainer>
    </section>
  );
}
