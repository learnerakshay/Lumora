import { LumoraLogo } from "@/components/brand/lumora-logo";
import { FoundationEntrance } from "@/components/motion/foundation-entrance";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-[var(--page-gutter)] py-16">
      <div className="w-full space-y-6">
        <LumoraLogo size="md" wordmark />
        <FoundationEntrance />
      </div>
    </main>
  );
}
