import { CirclePlay } from "lucide-react";
import type { ReactNode } from "react";
import { ProcessConnectionLayer } from "@/components/landing/how-it-works/process-connection-layer";
import { ProcessCore } from "@/components/landing/how-it-works/process-core";
import { ProcessOutputStack } from "@/components/landing/how-it-works/process-output-stack";
import { ProcessSourceStack } from "@/components/landing/how-it-works/process-source-stack";
import { LandingContainer } from "@/components/landing/shared/landing-section";
const Stage = ({
  caption,
  children,
  label,
}: {
  caption: string;
  children: ReactNode;
  label: string;
}) => (
  <div>
    <p className="text-xs font-medium tracking-[.16em] text-[#c9b0ff] uppercase">
      {label}
    </p>
    <p className="mt-2 mb-4 text-xs text-[var(--muted)]">{caption}</p>
    {children}
  </div>
);
export function HowLumoraWorksSection() {
  return (
    <section
      className="relative overflow-hidden py-24 sm:py-28"
      id="how-it-works"
    >
      <div
        aria-hidden
        className="absolute inset-x-[26%] top-20 h-96 bg-[radial-gradient(ellipse_at_center,rgb(124_92_255_/_16%),transparent_66%)]"
      />
      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 h-32 w-[min(60rem,100vw)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgb(124_92_255_/_16%),transparent_70%)]"
      />
      <LandingContainer className="relative">
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.35fr_.85fr_1.1fr_1.05fr] lg:gap-9">
          <ProcessConnectionLayer />
          <div>
            <p className="text-xs font-medium tracking-[.2em] text-[#c9b0ff] uppercase">
              How Lumora Works
            </p>
            <h2 className="mt-5 text-4xl font-medium tracking-[-.045em] text-balance">
              Collect. Understand.
              <br />
              Transform.
            </h2>
            <p className="mt-5 text-base leading-7 text-[var(--text-secondary)]">
              Lumora brings your sources together, understands the meaning, and
              transforms it into connected knowledge you can use.
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-sm text-[#c9b0ff]">
              <CirclePlay aria-hidden size={19} />
              See how it works
            </span>
          </div>
          <Stage caption="Import from anywhere" label="1. Collect">
            <ProcessSourceStack />
          </Stage>
          <Stage caption="Lumora processes and connects" label="2. Understand">
            <ProcessCore />
          </Stage>
          <Stage caption="Convert into useful knowledge" label="3. Transform">
            <ProcessOutputStack />
          </Stage>
        </div>
      </LandingContainer>
    </section>
  );
}
