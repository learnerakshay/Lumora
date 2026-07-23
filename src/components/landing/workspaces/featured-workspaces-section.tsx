import {
  BrainCircuit,
  ChartNoAxesCombined,
  Landmark,
  Milestone,
} from "lucide-react";
import { LandingContainer } from "@/components/landing/shared/landing-section";
import { WorkspaceShowcaseCard } from "@/components/landing/workspaces/workspace-showcase-card";
const cards = [
  [
    BrainCircuit,
    "ai",
    "Artificial Intelligence",
    "Explore foundational ideas, modern models, research papers, and emerging AI systems in one connected workspace.",
    ["34 Sources", "128 Concepts", "12 Insights"],
  ],
  [
    Milestone,
    "ml",
    "Machine Learning",
    "Connect algorithms, datasets, experiments, and applied techniques across one evolving knowledge system.",
    ["28 Sources", "96 Concepts", "9 Study Guides"],
  ],
  [
    ChartNoAxesCombined,
    "markets",
    "Financial Markets",
    "Track market structures, economic signals, company research, and investment frameworks in context.",
    ["42 Sources", "74 Insights", "6 Roadmaps"],
  ],
  [
    Landmark,
    "history",
    "History",
    "Map events, people, movements, and primary sources across timelines and interconnected themes.",
    ["31 Sources", "110 Concepts", "14 Timelines"],
  ],
] as const;
export function FeaturedWorkspacesSection() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-28">
      <div
        aria-hidden
        className="absolute inset-x-[20%] top-0 h-72 bg-[radial-gradient(ellipse_at_center,rgb(124_92_255_/_12%),transparent_68%)]"
      />
      <LandingContainer className="relative">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-[.18em] text-[#c9b0ff] uppercase">
            Featured Research Workspaces
          </p>
          <h2 className="mt-5 text-4xl font-medium tracking-[-.045em] text-balance sm:text-5xl">
            Explore knowledge in motion.
          </h2>
          <p className="mt-5 text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
            See how complex topics become connected, navigable research systems
            inside Lumora.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([icon, kind, title, description, metadata]) => (
            <WorkspaceShowcaseCard
              description={description}
              icon={icon}
              kind={kind}
              key={title}
              metadata={[...metadata]}
              title={title}
            />
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
