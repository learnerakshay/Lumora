import React from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { LivingKnowledgeSection } from '../components/landing/LivingKnowledgeSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { CtaSection } from '../components/landing/CtaSection';
import { Footer } from '../components/landing/Footer';

export function HomePage() {
  return (
    <main className="min-h-screen bg-[#0b0f17] text-[#f0f4f8] overflow-x-hidden">
      <HeroSection />
      <HowItWorksSection />
      <LivingKnowledgeSection />
      <FeaturesSection />
      <CtaSection />
      <Footer />
    </main>
  );
}
