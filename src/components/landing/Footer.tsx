import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { LumoraBrand } from './LumoraBrand';

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

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800/40 pt-6 sm:flex-row">
          <span className="text-slate-500">© 2026 Lumora. AI Knowledge Workspace.</span>
          <Link to="/contact" className={`${linkClasses} flex items-center gap-1.5`}>
            <Mail className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span>Contact</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
