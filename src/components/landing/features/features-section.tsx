import {
  BookOpen,
  BrainCircuit,
  FileSearch,
  MessageCircle,
  Network,
  Podcast,
  Route,
  Search,
} from "lucide-react";
import { FeatureCard } from "@/components/landing/features/feature-card";
import { LandingContainer } from "@/components/landing/shared/landing-section";
const features = [
  [
    MessageCircle,
    "AI Conversations",
    "Ask questions across your sources and receive context-aware answers grounded in your research.",
  ],
  [
    Network,
    "Knowledge Graph",
    "Explore the relationships between ideas, sources, concepts, and discoveries.",
  ],
  [
    FileSearch,
    "Source Insights",
    "Reveal important themes, summaries, contradictions, and connections across your materials.",
  ],
  [
    BookOpen,
    "Study Guides",
    "Transform complex research into structured, focused guides for deeper understanding.",
  ],
  [
    BrainCircuit,
    "Flashcards",
    "Generate active-recall cards directly from your notes, sources, and knowledge graph.",
  ],
  [
    Podcast,
    "Podcasts",
    "Turn your research into clear, conversational audio experiences for learning anywhere.",
  ],
  [
    Route,
    "Learning Roadmaps",
    "Build structured paths that guide you from foundational concepts to deeper mastery.",
  ],
  [
    Search,
    "Web Search",
    "Discover current sources and bring relevant research directly into your Lumora workspace.",
  ],
] as const;
export function FeaturesSection() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-28">
      <div
        aria-hidden
        className="absolute inset-x-[15%] top-0 h-80 bg-[radial-gradient(ellipse_at_center,rgb(124_92_255_/_13%),transparent_68%)]"
      />
      <LandingContainer className="relative">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-[.18em] text-[#c9b0ff] uppercase">
            Everything You Need to Research Better
          </p>
          <h2 className="mt-5 text-4xl font-medium tracking-[-.045em] text-balance sm:text-5xl">
            A complete workspace for connected learning.
          </h2>
          <p className="mt-5 text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
            From source discovery to active learning, Lumora gives you the tools
            to turn research into knowledge you can actually use.
          </p>
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {features.map(([icon, title, description], index) => (
            <FeatureCard
              description={description}
              icon={icon}
              index={index}
              key={title}
              title={title}
            />
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
