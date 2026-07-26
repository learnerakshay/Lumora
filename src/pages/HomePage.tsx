import React from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { LivingKnowledgeSection } from '../components/landing/LivingKnowledgeSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
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
        <LivingKnowledgeSection />
        <FeaturesSection />
        <CtaSection />
        <Footer />
      </div>
    </main>
  );
}
