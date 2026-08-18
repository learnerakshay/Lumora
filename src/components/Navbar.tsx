import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { LogOut, User, Github, Twitter, Menu, X as CloseIcon } from 'lucide-react';
import { LumoraBrand } from './landing/LumoraBrand';

export function Navbar() {
  const { isSignedIn, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isPublicPresentation = ['/', '/sign-in', '/sign-up', '/pricing'].includes(location.pathname);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  return (
    <header
      className={`${isPublicPresentation ? 'landing-navigation' : ''} sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0b0f17]/85 backdrop-blur-md shadow-[inset_0_-1px_0_rgba(148,163,184,0.09)] py-3'
          : 'bg-[#0b0f17]/30 backdrop-blur-sm py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/" className="group shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
          <LumoraBrand compact />
        </Link>

        {/* Desktop Nav Links (Public) */}
        <nav className="hidden lg:flex items-center gap-1">
          <button
            onClick={() => handleNavClick('overview')}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
          >
            Overview
          </button>
          <button
            onClick={() => handleNavClick('features')}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
          >
            Features
          </button>
          <button
            onClick={() => handleNavClick('about')}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
          >
            About
          </button>
          <Link
            to="/pricing"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
          >
            Pricing
          </Link>

          <span aria-hidden="true" className="mx-2 h-4 w-px bg-slate-800" />

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            title="GitHub Repository"
          >
            <Github className="w-4 h-4" />
          </a>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            title="X (Twitter)"
          >
            <Twitter className="w-4 h-4" />
          </a>
        </nav>

        {/* User Auth CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          {isSignedIn ? (
            <div className="flex items-center gap-2.5">
              <Link
                to="/workspaces"
                className="rounded-lg border border-slate-700/70 bg-[#121824] px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-[#182030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                Workspaces
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

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="animate-fade-in lg:hidden space-y-1 bg-[#0d1420]/98 backdrop-blur-md px-4 pt-3 pb-5 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
          <button
            onClick={() => handleNavClick('overview')}
            className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Overview
          </button>
          <button
            onClick={() => handleNavClick('features')}
            className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Features
          </button>
          <button
            onClick={() => handleNavClick('about')}
            className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            About
          </button>
          <Link
            to="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Pricing
          </Link>

          <div className="mt-2 flex items-center gap-1 border-t border-slate-800/70 pt-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              title="GitHub Repository"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              title="X (Twitter)"
            >
              <Twitter className="w-4 h-4" />
            </a>
          </div>

          <div className="flex flex-col gap-2 pt-3">
            {isSignedIn ? (
              <>
                <Link
                  to="/workspaces"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-lg bg-sky-500 py-2.5 text-center text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  Open Lumora
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full rounded-lg border border-red-900/50 bg-red-950/40 py-2.5 text-center text-xs text-red-300 transition-colors hover:bg-red-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full rounded-lg bg-sky-400 py-2.5 text-center text-xs font-semibold text-slate-950 shadow-sm transition-colors hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Try Lumora
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
