import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
// page the same header, optional section table of contents, readable measure,
// and site footer — so adding a new legal page is just supplying sections.
export function LegalPageLayout({ eyebrow, title, description, lastUpdated, toc, children }: LegalPageLayoutProps) {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] bg-[#070b12]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.07),transparent_60%)]" />

      <div className="mx-auto max-w-5xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Lumora
        </Link>

        <header className="mt-6 max-w-2xl space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-sky-400">{eyebrow}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
          {description && <p className="text-sm leading-7 text-slate-400">{description}</p>}
          {lastUpdated && <p className="text-xs text-slate-500">Last updated {lastUpdated}</p>}
        </header>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          {toc && toc.length > 0 && (
            <nav aria-label="Table of contents" className="hidden lg:block">
              <div className="sticky top-24 space-y-1 border-l border-slate-800/70 pl-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">On this page</p>
                {toc.map((entry) => (
                  <a
                    key={entry.id}
                    href={`#${entry.id}`}
                    className="block rounded-md py-1 text-xs text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    {entry.label}
                  </a>
                ))}
              </div>
            </nav>
          )}

          <article className="min-w-0 space-y-10 rounded-3xl border border-slate-800/60 bg-[#0d1420]/60 p-6 sm:p-9">
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

      <div className="relative overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
