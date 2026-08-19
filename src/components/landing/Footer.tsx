import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Cloud, Database, KeyRound, Mail, Radio, Send, Zap } from 'lucide-react';
import { LumoraBrand } from './LumoraBrand';

type HealthStatus = 'checking' | 'operational' | 'degraded';

const ARCHITECTURE_STAGES = [
  { icon: Zap, label: 'React 19 SPA', detail: 'Vite-built client, code-split per route' },
  { icon: KeyRound, label: 'Clerk Auth', detail: 'Session verified on every API request' },
  { icon: Radio, label: 'Express API', detail: '/api/workspaces + /api/usage routers' },
  { icon: Database, label: 'Retrieval Guardrails', detail: 'pgvector cosine search + Workspace isolation checks' },
  { icon: Cloud, label: 'Prisma → Neon Postgres', detail: 'Pooled connection, pgvector storage' },
  { icon: Send, label: 'SSE Stream', detail: 'Token-by-token response back to the client' },
] as const;

interface FooterLink {
  label: string;
  to?: string;
  anchor?: string;
}

const PRODUCT_LINKS: FooterLink[] = [
  { label: 'Overview', anchor: 'overview' },
  { label: 'Features', anchor: 'features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'FAQ', to: '/faq' },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
  { label: 'Report a Bug', to: '/report-bug' },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Refunds', to: '/terms#refunds' },
];

const linkClasses =
  'rounded-md text-slate-400 transition-colors hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400';

export function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [health, setHealth] = useState<HealthStatus>('checking');

  // A real check against the real endpoint, fetched once on mount — not a
  // fabricated uptime percentage. No third-party status-page integration
  // exists, so this is honestly scoped to "is the API reachable right now."
  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((response) => {
        if (!cancelled) setHealth(response.ok ? 'operational' : 'degraded');
      })
      .catch(() => {
        if (!cancelled) setHealth('degraded');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Overview/Features are landing-page anchor sections, not routes. From any
  // other page, navigate home first, then scroll once the landing chunk has
  // mounted — mirrors Navbar's handleNavClick so footer links behave the
  // same way whether you're already on "/" or somewhere else.
  const handleAnchorClick = (anchorId: string) => {
    const scrollWhenReady = () => {
      const el = document.getElementById(anchorId);
      if (!el) return;
      void import('./LandingSmoothScroll').then(({ scrollToLandingSection }) => scrollToLandingSection(el));
    };
    if (location.pathname !== '/') {
      navigate(`/#${anchorId}`);
      setTimeout(scrollWhenReady, 100);
    } else {
      scrollWhenReady();
    }
  };

  const renderLink = (link: FooterLink) => {
    if (link.anchor) {
      return (
        <button key={link.label} onClick={() => handleAnchorClick(link.anchor!)} className={`${linkClasses} cursor-pointer text-left`}>
          {link.label}
        </button>
      );
    }
    return (
      <Link key={link.label} to={link.to!} className={linkClasses}>
        {link.label}
      </Link>
    );
  };

  return (
    <footer className="landing-footer relative px-4 py-12 text-xs text-slate-400 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          {/* Brand + descriptor */}
          <div className="col-span-2 space-y-3 sm:col-span-4 lg:col-span-1">
            <Link to="/" className="group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
              <LumoraBrand compact />
            </Link>
            <p className="max-w-xs text-slate-500">
              An AI knowledge Workspace for grounded, cited answers over your own sources — and a Career Intelligence
              path from resume to role-ready.
            </p>
          </div>

          <nav aria-label="Product">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Product</p>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>{renderLink(link)}</li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Company</p>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>{renderLink(link)}</li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Legal</p>
            <ul className="space-y-2.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>{renderLink(link)}</li>
              ))}
            </ul>
          </nav>
        </div>

        <details id="architecture-drawer" className="group mt-10 rounded-2xl border border-slate-800/80 bg-[#101826]/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-200 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
            <span className="inline-flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.8} />
              View Engineering Architecture
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180 group-open:text-cyan-300" />
          </summary>
          <div className="flex flex-wrap items-stretch gap-2 px-4 pb-5">
            {ARCHITECTURE_STAGES.map((stage, index) => (
              <React.Fragment key={stage.label}>
                <div className="flex min-w-[9.5rem] flex-1 items-start gap-2 rounded-lg border border-slate-800/70 bg-slate-900/60 p-2.5">
                  <stage.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" strokeWidth={1.75} />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-200">{stage.label}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{stage.detail}</p>
                  </div>
                </div>
                {index < ARCHITECTURE_STAGES.length - 1 && (
                  <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 self-center text-slate-700 sm:block" aria-hidden="true" />
                )}
              </React.Fragment>
            ))}
          </div>
        </details>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-slate-800/40 pt-6 sm:flex-row">
          <span className="text-slate-500">© 2026 Lumora. AI Knowledge Workspace.</span>
          <div className="flex items-center gap-5">
            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  health === 'operational'
                    ? 'animate-pulse bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                    : health === 'degraded'
                      ? 'bg-rose-400'
                      : 'bg-slate-600'
                }`}
              />
              <span>
                {health === 'operational'
                  ? 'All Systems Operational'
                  : health === 'degraded'
                    ? 'Service Degraded'
                    : 'Checking status…'}
              </span>
            </a>
            <Link to="/contact" className={`${linkClasses} flex items-center gap-1.5`}>
              <Mail className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>Contact</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
