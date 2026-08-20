import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { CreditCard, Radar, Search, Sparkles } from 'lucide-react';

interface SpotlightLauncherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SpotlightAction {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  run: (navigate: NavigateFunction, pathname: string) => void;
}

// Lazy-imported so Lenis/GSAP are only downloaded once a jump is actually
// used — mirrors the identical pattern Navbar.tsx and Footer.tsx already use
// for their own anchor links.
function goToAnchor(navigate: NavigateFunction, pathname: string, anchorId: string) {
  const scrollWhenReady = () => {
    const el = document.getElementById(anchorId);
    if (!el) return;
    void import('./LandingSmoothScroll').then(({ scrollToLandingSection }) => scrollToLandingSection(el));
  };
  if (pathname !== '/') {
    navigate(`/#${anchorId}`);
    window.setTimeout(scrollWhenReady, 150);
  } else {
    scrollWhenReady();
  }
}

const ACTIONS: SpotlightAction[] = [
  {
    id: 'grounding',
    label: 'Test RAG Grounding',
    hint: 'See the grounded-vs-general evidence demo',
    icon: Sparkles,
    run: (navigate, pathname) => goToAnchor(navigate, pathname, 'grounding'),
  },
  {
    id: 'radar',
    label: 'Career Competency Radar',
    hint: 'Role-fit gaps across six skill dimensions',
    icon: Radar,
    run: (navigate, pathname) => goToAnchor(navigate, pathname, 'career-intelligence'),
  },
  {
    id: 'pricing',
    label: 'Compare Plans',
    hint: 'FREE, CORE, and MAX side by side',
    icon: CreditCard,
    run: (navigate) => navigate('/pricing'),
  },
];

// Global ⌘K / Ctrl+K quick launcher. Open state is owned by Navbar (two
// physical triggers — desktop pill button and mobile menu button — need to
// share it); this component owns only the keyboard shortcut, the dialog UI,
// and where each action actually goes.
export function SpotlightLauncher({ open, onOpenChange }: SpotlightLauncherProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        // The Support page has its own visible, route-specific search. Let it
        // own the advertised shortcut instead of opening two search surfaces.
        if (location.pathname === '/contact') return;
        event.preventDefault();
        onOpenChange(true);
      } else if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [location.pathname, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setActiveIndex(0);
    // setTimeout, not requestAnimationFrame — RAF can silently never fire in
    // a backgrounded tab (the exact bug found and fixed in CheckoutDialog).
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  const filtered = useMemo(
    () => ACTIONS.filter((action) => action.label.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  const runAction = (action: SpotlightAction) => {
    onOpenChange(false);
    action.run(navigate, location.pathname);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault();
      runAction(filtered[activeIndex]);
    }
  };

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={() => onOpenChange(false)}
      className="animate-fade-in fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/70 px-4 pt-[14vh] backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick launcher"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0d1420]/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-800/70 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a demo, a page, or a feature…"
            aria-label="Search quick actions"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline">
            Esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">No matches.</li>}
          {filtered.map((action, index) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => runAction(action)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  index === activeIndex ? 'bg-sky-500/10 text-sky-200' : 'text-slate-300'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    index === activeIndex
                      ? 'border-sky-500/50 bg-sky-950/60 text-sky-300'
                      : 'border-slate-800 bg-slate-900/70 text-slate-400'
                  }`}
                >
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{action.label}</span>
                  <span className="block truncate text-[11px] text-slate-500">{action.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
