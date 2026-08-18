import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ErrorPageProps {
  code: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  actions: React.ReactNode;
}

// Shared shell for the 404 / 403 / 500 / offline states. Deliberately
// minimal — a faint oversized status code, one icon, and caller-supplied
// actions (which differ by auth state and by which failure this is).
export function ErrorPage({ code, icon: Icon, eyebrow, title, description, actions }: ErrorPageProps) {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-[#070b12] px-4 py-20 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <span className="select-none text-[13rem] font-black leading-none tracking-tight text-white/[0.03] sm:text-[18rem]">
          {code}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.06),transparent_60%)]" />

      <div className="animate-fade-in mx-auto flex max-w-md flex-col items-center space-y-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-800/50 bg-sky-950/40 text-sky-300">
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-sky-400">{eyebrow}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
          <p className="text-sm leading-relaxed text-slate-400">{description}</p>
        </div>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">{actions}</div>
      </div>
    </main>
  );
}
