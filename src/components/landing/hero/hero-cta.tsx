import { ArrowRight } from "lucide-react";

type HeroCtaProps = {
  compact?: boolean;
};

export function HeroCta({ compact = false }: HeroCtaProps) {
  // TODO(authentication): route this CTA to /start once Clerk is implemented.
  return (
    <button
      className={
        compact
          ? "inline-flex min-h-10 items-center rounded-full border border-[#caa3ff] bg-[linear-gradient(100deg,#4936d5,#7437c4)] px-5 text-sm font-semibold text-white shadow-[0_10px_26px_rgb(124_92_255_/_22%)] transition-transform hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
          : "inline-flex min-h-14 items-center gap-3 rounded-full border border-[#d8b5ff] bg-[linear-gradient(100deg,#4936d5,#7437c4)] px-9 text-lg font-semibold text-white shadow-[0_14px_32px_rgb(124_92_255_/_34%)] transition-transform hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 sm:px-11"
      }
      aria-disabled="true"
      type="button"
    >
      Try Lumora Now
      {!compact && <ArrowRight aria-hidden size={20} strokeWidth={1.7} />}
    </button>
  );
}
