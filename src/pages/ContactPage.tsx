import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bug, FileText, HelpCircle, Mail, Shield } from 'lucide-react';
import { Footer } from '../components/landing/Footer';
import { SupportCard } from '../components/shared/SupportCard';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/support-config';

const SELF_SERVICE_LINKS = [
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
  { to: '/terms', label: 'Terms of Use', icon: FileText },
  { to: '/privacy', label: 'Privacy Policy', icon: Shield },
];

export function ContactPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#070b12] text-[#f0f4f8]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.07),transparent_60%)]" />

      <div className="px-4 pb-16 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Lumora
          </Link>

          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-sky-400">Lumora support</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Contact us</h1>
            <p className="max-w-xl text-sm leading-7 text-slate-400">
              For anything about Workspaces, chat, Career Intelligence, or billing, the fastest path is email or the
              Bug Report form below.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SupportCard
              icon={Mail}
              title="General Support"
              description="Questions about your account, a Workspace, billing, or anything else."
              action={
                <a
                  href={SUPPORT_MAILTO}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-sky-700/60 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  {SUPPORT_EMAIL}
                </a>
              }
            />
            <SupportCard
              icon={Bug}
              title="Bug or Technical Issue"
              description="Ingestion failures, incorrect citations, payment issues, or anything that looks broken."
              action={
                <Link
                  to="/report-bug"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  Report a Bug
                </Link>
              }
            />
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Useful self-service</p>
            <div className="flex flex-wrap gap-3">
              {SELF_SERVICE_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-800/70 bg-[#101826]/80 px-3.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <link.icon className="h-3.5 w-3.5" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
