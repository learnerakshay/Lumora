import React from 'react';
import { Link } from 'react-router-dom';

interface LegalPageProps {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}

export function LegalPage({ eyebrow, title, children }: LegalPageProps) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#070b12] px-4 py-20 text-slate-300 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-2xl rounded-3xl border border-slate-800/80 bg-[#101826]/90 p-7 shadow-[0_24px_70px_rgba(2,8,23,0.34)] sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-sky-400">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-slate-400">{children}</div>
        <Link to="/" className="mt-8 inline-flex rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-sky-700/70 hover:text-sky-200">
          Return to Lumora
        </Link>
      </article>
    </main>
  );
}
