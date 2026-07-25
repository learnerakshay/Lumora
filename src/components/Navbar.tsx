import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { LogOut, User, Sparkles, Github, Twitter, Menu, X as CloseIcon } from 'lucide-react';

export function Navbar() {
  const { isSignedIn, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleNavClick = (anchorId: string) => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate(`/#${anchorId}`);
      setTimeout(() => {
        const el = document.getElementById(anchorId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 border-b ${
        scrolled
          ? 'bg-[#0b0f17]/85 backdrop-blur-md border-slate-800/80 shadow-lg shadow-sky-950/10 py-3'
          : 'bg-[#0b0f17]/40 backdrop-blur-sm border-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:border-sky-400/60 group-hover:bg-sky-500/20 transition-all">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-sky-300 transition-colors">
              Lumora
            </span>
            <span className="text-[10px] tracking-widest text-slate-400 uppercase font-mono -mt-1">
              Knowledge OS
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links (Public) */}
        <nav className="hidden md:flex items-center space-x-8">
          <button
            onClick={() => handleNavClick('overview')}
            className="text-xs font-medium text-slate-300 hover:text-sky-300 transition-colors cursor-pointer"
          >
            Overview
          </button>
          <button
            onClick={() => handleNavClick('features')}
            className="text-xs font-medium text-slate-300 hover:text-sky-300 transition-colors cursor-pointer"
          >
            Features
          </button>
          <button
            onClick={() => handleNavClick('about')}
            className="text-xs font-medium text-slate-300 hover:text-sky-300 transition-colors cursor-pointer"
          >
            About
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white transition-colors"
            title="GitHub Repository"
          >
            <Github className="w-4 h-4" />
          </a>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white transition-colors"
            title="X (Twitter)"
          >
            <Twitter className="w-4 h-4" />
          </a>
        </nav>

        {/* User Auth CTAs */}
        <div className="hidden md:flex items-center space-x-4">
          {isSignedIn ? (
            <div className="flex items-center space-x-3">
              <Link
                to="/workspaces"
                className="text-xs font-semibold text-slate-200 bg-[#121824] hover:bg-[#182030] border border-slate-700/80 px-3.5 py-2 rounded-lg transition-colors"
              >
                Workspaces
              </Link>
              <div className="flex items-center space-x-2 bg-[#121824] border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300">
                <div className="w-5 h-5 rounded-full bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-300 font-semibold text-[10px]">
                  {user?.fullName ? user.fullName[0].toUpperCase() : <User className="w-3 h-3" />}
                </div>
                <span className="font-medium text-slate-200 max-w-[120px] truncate">
                  {user?.fullName || user?.email}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1.5 text-xs font-medium text-slate-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded-md hover:bg-red-950/20 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                to="/sign-in"
                className="text-xs font-medium text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-700 bg-[#121824]"
              >
                Sign In
              </Link>
              <Link
                to="/sign-in"
                className="text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 transition-all px-4 py-2 rounded-lg shadow-md shadow-sky-500/20 hover:shadow-sky-400/30"
              >
                Try Lumora Now
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#121824] border-b border-slate-800 px-4 pt-3 pb-5 space-y-3">
          <button
            onClick={() => handleNavClick('overview')}
            className="block w-full text-left py-2 text-sm text-slate-300 hover:text-sky-300"
          >
            Overview
          </button>
          <button
            onClick={() => handleNavClick('features')}
            className="block w-full text-left py-2 text-sm text-slate-300 hover:text-sky-300"
          >
            Features
          </button>
          <button
            onClick={() => handleNavClick('about')}
            className="block w-full text-left py-2 text-sm text-slate-300 hover:text-sky-300"
          >
            About
          </button>

          <div className="pt-3 border-t border-slate-800 flex flex-col space-y-2">
            {isSignedIn ? (
              <>
                <Link
                  to="/workspaces"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 bg-sky-500 text-slate-950 font-semibold text-xs rounded-lg"
                >
                  Go to Workspaces
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full text-center py-2 bg-red-950/40 text-red-300 text-xs rounded-lg border border-red-900/50"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 bg-sky-400 text-slate-950 font-semibold text-xs rounded-lg shadow-sm"
              >
                Try Lumora Now
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
