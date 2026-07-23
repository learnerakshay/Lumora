import { FeaturesSection } from "@/components/landing/features/features-section";
import { FinalCtaSection } from "@/components/landing/final-cta/final-cta-section";
import { LandingFooter } from "@/components/landing/footer/landing-footer";
import { LandingHeroPlaceholder } from "@/components/landing/hero/landing-hero-placeholder";
import { HowLumoraWorksSection } from "@/components/landing/how-it-works/how-lumora-works-section";
import { LivingKnowledgeSection } from "@/components/landing/living-knowledge/living-knowledge-section";
import { LandingNav } from "@/components/landing/navigation/landing-nav";
import { FeaturedWorkspacesSection } from "@/components/landing/workspaces/featured-workspaces-section";
import { LenisWrapper } from "@/components/motion/lenis-wrapper";
export function LandingPageShell() {
  return (
    <LenisWrapper>
      <a className="sr-only focus:not-sr-only" href="#landing-content">
        Skip to content
      </a>
      <LandingNav />
      <main id="landing-content">
        <LandingHeroPlaceholder />
        <HowLumoraWorksSection />
        <LivingKnowledgeSection />
        <FeaturesSection />
        <FeaturedWorkspacesSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </LenisWrapper>
  );
}
