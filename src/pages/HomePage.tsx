import React from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { EvidenceTrustSection } from '../components/landing/EvidenceTrustSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { CareerIntelligenceSection } from '../components/landing/CareerIntelligenceSection';
import { PricingSection } from '../components/pricing/PricingSection';
import { CtaSection } from '../components/landing/CtaSection';
import { Footer } from '../components/landing/Footer';
import { LandingAtmosphere } from '../components/landing/LandingAtmosphere';
import { LandingSmoothScroll } from '../components/landing/LandingSmoothScroll';
import '../components/landing/landing-motion.css';

export function HomePage() {
  return (
    <main className="landing-experience relative min-h-screen overflow-x-hidden text-[#f0f4f8]">
      <LandingSmoothScroll />
      <LandingAtmosphere />
      <div className="relative z-10">
        <HeroSection />
        <HowItWorksSection />
        <EvidenceTrustSection />
        <FeaturesSection />
        <CareerIntelligenceSection />
        <PricingSection />
        <div className="landing-closing-surface relative overflow-hidden">
          <CtaSection />
          <Footer />
        </div>
      </div>
    </main>
  );
}
