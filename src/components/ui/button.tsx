import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
};
export function Button({
  className,
  children,
  disabled,
  loading = false,
  variant = "primary",
  ...props
}: ButtonProps) {
  const styles = {
    primary: "bg-[var(--accent)] text-white hover:bg-[#8a70ff]",
    secondary:
      "border bg-[var(--surface-elevated)] text-[var(--foreground)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)]",
    ghost:
      "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
    destructive:
      "border border-[var(--destructive)]/70 text-[var(--destructive)] hover:bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-[var(--radius)] px-4 text-sm font-medium shadow-sm disabled:opacity-50",
        styles[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Working…" : children}
    </button>
  );
}
