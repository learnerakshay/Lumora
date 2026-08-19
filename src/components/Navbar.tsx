import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { LogOut, User, Menu, X as CloseIcon, ArrowRight, Search } from 'lucide-react';
import { LumoraBrand } from './landing/LumoraBrand';
import { SpotlightLauncher } from './landing/SpotlightLauncher';

const NAV_SECTION_IDS = ['overview', 'features', 'about'] as const;
type NavSectionId = (typeof NAV_SECTION_IDS)[number];

export function Navbar() {
  const { isSignedIn, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSectionId | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const [hideOnMobileScroll, setHideOnMobileScroll] = useState(false);
  const isPublicPresentation = ['/', '/sign-in', '/sign-up', '/pricing'].includes(location.pathname);

  const navListRef = useRef<HTMLElement>(null);
  const navButtonRefs = useRef<Partial<Record<NavSectionId, HTMLButtonElement | null>>>({});
  const lastScrollYRef = useRef(0);

  // Mobile-only: hide the pill on scroll-down past 80px, restore instantly
  // on scroll-up — reclaims viewport on small screens without touching
  // desktop, where the navbar always stays put.
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      if (window.innerWidth < 768) {
        if (y > 80 && y > lastScrollYRef.current) setHideOnMobileScroll(true);
        else if (y < lastScrollYRef.current) setHideOnMobileScroll(false);
      } else {
        setHideOnMobileScroll(false);
      }
      lastScrollYRef.current = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Active-section underline: which landing anchor is currently in view.
  // Only meaningful on "/" — the other public routes don't have these
  // sections at all.
  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveSection(null);
      return;
    }
    const elements = NAV_SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // The rootMargin below shrinks the observed viewport to a thin band
        // near center; sections here are far taller than that band, so
        // intersectionRatio stays tiny (never crosses a ratio threshold) —
        // threshold 0 + isIntersecting is the correct boolean signal.
        const inBand = entries.find((entry) => entry.isIntersecting);
        if (inBand) setActiveSection(inBand.target.id as NavSectionId);
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [location.pathname]);

  // Recompute the underline's position (a transform, not a re-layout on
  // every scroll tick) only when the active section actually changes.
  useEffect(() => {
    const button = activeSection ? navButtonRefs.current[activeSection] : null;
    if (button && navListRef.current) {
      const navRect = navListRef.current.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      setIndicator({ left: buttonRect.left - navRect.left, width: buttonRect.width });
    } else {
      setIndicator(null);
    }
  }, [activeSection]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Lazy-imported so the smooth-scroll module (Lenis + GSAP) is only ever
  // downloaded when a landing-page nav link is actually clicked, never as
  // part of the app's initial/authenticated bundle.
  const handleNavClick = (anchorId: string) => {
    setMobileMenuOpen(false);
    const scrollWhenReady = () => {
      const el = document.getElementById(anchorId);
      if (!el) return;
      void import('./landing/LandingSmoothScroll').then(({ scrollToLandingSection }) =>
        scrollToLandingSection(el),
      );
    };
    if (location.pathname !== '/') {
      navigate(`/#${anchorId}`);
      setTimeout(scrollWhenReady, 100);
    } else {
      scrollWhenReady();
    }
  };

  // The Workspace dashboard provides its own authenticated app navigation.
  // Keep the existing header on the learning Workspace route unchanged.
  if (location.pathname.startsWith('/workspaces') || location.pathname === '/usage' || location.pathname === '/skills' || location.pathname === '/billing') return null;

  // hideOnMobileScroll is only ever set true from within the
  // window.innerWidth < 768 branch of the scroll handler above, so this
  // transform is already runtime-gated to mobile without needing a
  // responsive CSS variant — applied via inline style so desktop is
  // untouched by construction, not by a breakpoint class.
  //
  // The transform lives on this inner div, never on <header> itself:
  // <header> is position:sticky, and transform on an actively-stuck sticky
  // element is a known-fragile interaction (confirmed directly in this
  // environment — a fresh, never-stuck sticky element responds to transform
  // normally, but the live, already-stuck header did not). A plain child
  // div has no such edge case. It also keeps SpotlightLauncher and the
  // mobile overlay (both position:fixed, rendered as later siblings of this
  // div, not inside it) off of a transformed ancestor — a transformed
  // ancestor would otherwise become their containing block and break their
  // viewport-relative fixed positioning.
  const mobileNavHidden = hideOnMobileScroll && !mobileMenuOpen && !spotlightOpen;

  return (
    <header className="sticky top-0 z-50 w-full px-3 pt-3 sm:px-4">
      <div
        className={`${isPublicPresentation ? 'landing-navigation' : ''} mx-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-full border px-4 py-2.5 backdrop-blur-xl sm:px-6 ${
          scrolled
            ? 'border-slate-800/80 bg-[#0b0f17]/85 shadow-2xl shadow-black/40'
            : 'border-slate-800/40 bg-[#0b0f17]/55 shadow-xl shadow-black/15'
        }`}
        style={{
          transform: mobileNavHidden ? 'translateY(-6rem)' : 'translateY(0)',
          transition: 'transform 300ms ease, background-color 250ms ease, border-color 250ms ease, box-shadow 250ms ease',
        }}
      >
        {/* Brand Logo */}
        <Link to="/" className="group shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
          <LumoraBrand compact />
        </Link>

        {/* Desktop Nav Links (Public) */}
        <nav ref={navListRef} className="relative hidden lg:flex items-center gap-1">
          <button
            ref={(el) => { navButtonRefs.current.overview = el; }}
            onClick={() => handleNavClick('overview')}
            className={`landing-nav-link rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer ${activeSection === 'overview' ? 'text-sky-300' : 'text-slate-300 hover:text-sky-300'}`}
          >
            Overview
          </button>
          <button
            ref={(el) => { navButtonRefs.current.features = el; }}
            onClick={() => handleNavClick('features')}
            className={`landing-nav-link rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer ${activeSection === 'features' ? 'text-sky-300' : 'text-slate-300 hover:text-sky-300'}`}
          >
            Features
          </button>
          <button
            ref={(el) => { navButtonRefs.current.about = el; }}
            onClick={() => handleNavClick('about')}
            className={`landing-nav-link rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer ${activeSection === 'about' ? 'text-sky-300' : 'text-slate-300 hover:text-sky-300'}`}
          >
            About
          </button>
          <Link
            to="/pricing"
            className="landing-nav-link rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
          >
            Pricing
          </Link>

          {indicator && (
            <span
              aria-hidden="true"
              className="nav-active-underline pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-sky-400 transition-all duration-300 ease-out"
              style={{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }}
            />
          )}

          <span aria-hidden="true" className="mx-2 h-4 w-px bg-slate-800" />

          <button
            type="button"
            onClick={() => setSpotlightOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#121824]/70 px-2.5 py-1.5 text-[11px] text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
            title="Quick launcher"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="ml-0.5 rounded border border-slate-700 bg-slate-900 px-1 font-mono text-[10px] text-slate-500">
              ⌘K
            </kbd>
          </button>
        </nav>

        {/* User Auth CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          {isSignedIn ? (
            <div className="flex items-center gap-2.5">
              <Link
                to="/workspaces"
                className="landing-nav-cta inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-[#121824] px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-[#182030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <span>Workspaces</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
              <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#121824] px-3 py-1.5 text-xs text-slate-300">
                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-sky-800/60 bg-sky-950 text-[10px] font-semibold text-sky-300">
                  {user?.fullName ? user.fullName[0].toUpperCase() : <User className="w-3 h-3" />}
                </div>
                <span className="max-w-[120px] truncate font-medium text-slate-200">
                  {user?.fullName || user?.email}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-red-950/20 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/sign-in"
                className="rounded-lg border border-slate-800 bg-[#121824] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                Sign In
              </Link>
              <Link
                to="/sign-in"
                className="rounded-lg bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-300 hover:shadow-sky-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Try Lumora
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="lg:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <SpotlightLauncher open={spotlightOpen} onOpenChange={setSpotlightOpen} />

      {/* Mobile full-screen nav overlay — the header (z-50) stays above it,
          so the hamburger/close toggle remains reachable throughout. */}
      {mobileMenuOpen && (
        <div
          className="mobile-nav-overlay animate-fade-in fixed inset-0 z-40 flex flex-col bg-[#0a0e16]/97 backdrop-blur-md lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="flex flex-1 flex-col justify-center gap-1.5 px-6 pb-16 pt-20"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => handleNavClick('overview')}
              className="block w-full rounded-lg px-3 py-3 text-left text-lg font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Overview
            </button>
            <button
              onClick={() => handleNavClick('features')}
              className="block w-full rounded-lg px-3 py-3 text-left text-lg font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Features
            </button>
            <button
              onClick={() => handleNavClick('about')}
              className="block w-full rounded-lg px-3 py-3 text-left text-lg font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              About
            </button>
            <Link
              to="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full rounded-lg px-3 py-3 text-left text-lg font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Pricing
            </Link>

            <div className="mt-4 border-t border-slate-800/70 pt-4">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSpotlightOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-[#121824]/70 px-3 py-3 text-left text-sm text-slate-300 transition-colors hover:border-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <Search className="h-4 w-4" />
                <span>Quick launcher</span>
              </button>
            </div>

            <div className="flex flex-col gap-2.5 pt-5">
              {isSignedIn ? (
                <>
                  <Link
                    to="/workspaces"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full rounded-lg bg-sky-500 py-3 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    Open Lumora
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="w-full rounded-lg border border-red-900/50 bg-red-950/40 py-3 text-center text-sm text-red-300 transition-colors hover:bg-red-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-lg bg-sky-400 py-3 text-center text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  Try Lumora
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
