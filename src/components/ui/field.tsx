import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
const fieldClass =
  "w-full rounded-[var(--radius)] border bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-disabled)] hover:border-[var(--border-strong)] focus:border-[var(--accent-cyan)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent-cyan)_22%,transparent)]";
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}
export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldClass, "min-h-24 resize-y", className)}
      {...props}
    />
  );
}
