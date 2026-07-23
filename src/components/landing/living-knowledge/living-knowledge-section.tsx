import { LivingKnowledgeDiagram } from "@/components/landing/living-knowledge/living-knowledge-diagram";
import { KnowledgePrinciples } from "@/components/landing/living-knowledge/knowledge-principles";
import { LandingContainer } from "@/components/landing/shared/landing-section";
export function LivingKnowledgeSection() {
  return (
    <section className="relative -mt-8 overflow-hidden py-24 sm:py-28">
      <div
        aria-hidden
        className="absolute inset-x-[10%] top-0 h-36 bg-[radial-gradient(ellipse_at_center,rgb(124_92_255_/_16%),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute top-20 right-[12%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgb(124_92_255_/_15%),transparent_65%)]"
      />
      <LandingContainer className="relative grid gap-12 lg:grid-cols-[.48fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-medium tracking-[.2em] text-[#c9b0ff] uppercase">
            The Living Knowledge System
          </p>
          <h2 className="mt-5 text-4xl font-medium tracking-[-.045em] text-balance sm:text-5xl">
            Knowledge that grows with every source.
          </h2>
          <p className="mt-5 text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
            Every source strengthens your understanding. Lumora connects ideas,
            reveals relationships, and turns research into a living system you
            can explore.
          </p>
          <KnowledgePrinciples />
        </div>
        <LivingKnowledgeDiagram />
      </LandingContainer>
    </section>
  );
}
