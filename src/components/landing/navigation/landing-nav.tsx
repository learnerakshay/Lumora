import Link from "next/link";
import { LumoraLogo } from "@/components/brand/lumora-logo";
import { HeroCta } from "@/components/landing/hero/hero-cta";
import { LandingContainer } from "@/components/landing/shared/landing-section";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#060912]/86 backdrop-blur-xl">
      <LandingContainer className="flex min-h-[4.5rem] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-9">
          <Link aria-label="Lumora overview" href="/">
            <LumoraLogo
              className="[&>span:last-child]:text-[1.125rem]"
              decorative
              size="md"
              wordmark
            />
          </Link>
          <nav
            aria-label="Landing navigation"
            className="hidden items-center gap-7 text-sm text-[var(--text-secondary)] lg:flex"
          >
            <a className="hover:text-[var(--foreground)]" href="#overview">
              Overview
            </a>
            <a className="hover:text-[var(--foreground)]" href="#plans">
              Plans
            </a>
          </nav>
        </div>
        <div className="flex items-center justify-end gap-4">
          <div className="hidden items-center gap-4 text-sm text-[var(--text-secondary)] sm:flex">
            <a
              className="hover:text-[var(--foreground)]"
              href="https://github.com"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <a
              className="hover:text-[var(--foreground)]"
              href="https://x.com"
              rel="noreferrer"
              target="_blank"
            >
              X
            </a>
          </div>
          <HeroCta compact />
        </div>
      </LandingContainer>
    </header>
  );
}
