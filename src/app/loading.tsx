import { LumoraLogo } from "@/components/brand/lumora-logo";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto grid min-h-screen max-w-4xl content-center gap-6 px-[var(--page-gutter)]"
    >
      <LumoraLogo decorative size="sm" wordmark />
      <div className="grid gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-3/4 max-w-sm" />
      </div>
    </main>
  );
}
