import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, Copy, Printer } from 'lucide-react';
import { Footer } from '../landing/Footer';

interface TocEntry {
  id: string;
  label: string;
}

interface LegalPageLayoutProps {
  eyebrow: string;
  title: string;
  description?: string;
  lastUpdated?: string;
  toc?: TocEntry[];
  children: React.ReactNode;
}

// Shared shell for long-form policy pages (Terms, Privacy). Gives every such
// page the same header, optional scroll-spy table of contents, readable
// measure, and site footer — so adding a new legal page is just supplying
// sections.
export function LegalPageLayout({ eyebrow, title, description, lastUpdated, toc, children }: LegalPageLayoutProps) {
  const [activeId, setActiveId] = useState<string | null>(toc?.[0]?.id ?? null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!toc || toc.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    );
    const elements = toc
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => Boolean(el));
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [toc]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context); the URL
      // is still visible in the address bar as a fallback.
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-[#f0f4f8]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
      <div aria-hidden="true" className="dashboard-starfield pointer-events-none fixed inset-0 -z-10 opacity-30" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md transition-all hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Lumora
        </Link>

        <header className="mt-6 max-w-2xl space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-400">{eyebrow}</p>
          <h1 className="bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
            {title}
          </h1>
          {description && <p className="text-sm leading-7 text-slate-400">{description}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {lastUpdated && (
              <span className="flex w-fit items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-400 shadow-md">
                <Clock3 className="h-3 w-3" /> Last updated {lastUpdated}
              </span>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-400 shadow-md transition-colors hover:text-cyan-300"
            >
              <Printer className="h-3 w-3" /> Print document
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-400 shadow-md transition-colors hover:text-cyan-300"
            >
              {linkCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {linkCopied ? 'Link copied!' : 'Copy page link'}
            </button>
          </div>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          {toc && toc.length > 0 && (
            <nav aria-label="Table of contents" className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl backdrop-blur-xl">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">On this page</p>
                {toc.map((entry) => {
                  const isActive = activeId === entry.id;
                  return (
                    <a
                      key={entry.id}
                      href={`#${entry.id}`}
                      aria-current={isActive ? 'true' : undefined}
                      className={`block rounded-r-lg border-l-2 py-1 pl-3 text-xs transition-all ${
                        isActive
                          ? 'border-cyan-400 bg-cyan-950/30 font-medium text-cyan-300'
                          : 'border-transparent text-slate-400 hover:text-sky-300'
                      }`}
                    >
                      {entry.label}
                    </a>
                  );
                })}
              </div>
            </nav>
          )}

          <article className="min-w-0 space-y-8 rounded-2xl border border-slate-800/80 bg-[#101621]/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
            {toc && toc.length > 0 && (
              <details className="rounded-xl border border-slate-800/70 bg-[#101826]/80 p-3 lg:hidden">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400 [&::-webkit-details-marker]:hidden">
                  On this page
                </summary>
                <div className="mt-2 space-y-1">
                  {toc.map((entry) => (
                    <a key={entry.id} href={`#${entry.id}`} className="block rounded-md px-1 py-1.5 text-xs text-slate-400 hover:text-sky-300">
                      {entry.label}
                    </a>
                  ))}
                </div>
              </details>
            )}
            {children}
          </article>
        </div>
      </div>

      <div className="relative z-10 overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
