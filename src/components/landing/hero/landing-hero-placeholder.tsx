import { HeroCta } from "@/components/landing/hero/hero-cta";
import { LumoraCoreScene } from "@/components/landing/hero/lumora-core-scene";
import { LandingContainer } from "@/components/landing/shared/landing-section";

export function LandingHeroPlaceholder() {
  return (
    <section className="relative isolate overflow-hidden" id="overview">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,#050812_0%,#080b18_37%,#090a13_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[6%] top-[18rem] -z-10 h-[28rem] rotate-[-8deg] bg-[linear-gradient(90deg,transparent,rgb(124_92_255_/_20%),transparent)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[8%] top-[25rem] -z-10 h-[25rem] rotate-[7deg] bg-[linear-gradient(90deg,transparent,rgb(95_211_255_/_13%),transparent)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[29rem] left-1/2 -z-10 h-[31rem] w-[min(54rem,94vw)] -translate-x-1/2 rounded-full border border-[var(--accent)]/12 bg-[radial-gradient(ellipse_at_center,rgb(124_92_255_/_18%),transparent_64%)]"
      />
      <LandingContainer className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center pt-16 text-center sm:pt-20 lg:pt-24">
        <p className="text-xs font-medium tracking-[0.25em] text-[#b28aff] uppercase">
          Your Knowledge Observatory
        </p>
        <h1 className="mt-7 max-w-5xl text-5xl leading-[0.98] font-medium tracking-[-0.055em] text-balance sm:text-6xl lg:text-8xl">
          Turn scattered knowledge into lasting{" "}
          <span className="text-[#b988ff]">understanding.</span>
        </h1>
        <p className="mt-6 text-lg font-medium tracking-[0.06em] text-[var(--text-secondary)] sm:text-xl">
          Research. Connect. Learn.
        </p>
        <p className="mt-5 max-w-4xl text-base leading-7 text-pretty text-[var(--text-secondary)] sm:text-lg sm:leading-8">
          Turn scattered sources into connected knowledge you can understand,
          explore, and use.
        </p>
        <div className="mt-8">
          <HeroCta />
        </div>
        <LumoraCoreScene />
      </LandingContainer>
    </section>
  );
}
