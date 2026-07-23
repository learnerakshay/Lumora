import { LumoraMark } from "@/components/brand/lumora-mark";
import { HeroCta } from "@/components/landing/hero/hero-cta";
export function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden py-28 text-center sm:py-36">
      <div
        aria-hidden
        className="absolute inset-x-[12%] top-8 h-[34rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgb(124_92_255_/_20%),transparent_67%)]"
      />
      <div className="relative mx-auto max-w-3xl px-[var(--page-gutter)]">
        <LumoraMark className="mx-auto h-20 w-20" decorative />
        <p className="mt-8 text-xs font-medium tracking-[.2em] text-[#c9b0ff] uppercase">
          Ready to Start?
        </p>
        <h2 className="mt-5 text-4xl font-medium tracking-[-.05em] sm:text-6xl">
          Build knowledge, not just notes.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
          Bring your PDFs, websites, videos and ideas together in one connected
          workspace built for real understanding.
        </p>
        <div className="mt-9">
          <HeroCta />
          <p className="mt-5 text-sm text-[var(--muted)]">
            Powered by connected research, not isolated conversations.
          </p>
        </div>
      </div>
    </section>
  );
}
