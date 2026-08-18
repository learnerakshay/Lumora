import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bug, FileText, HelpCircle, LifeBuoy, Mail, Shield } from 'lucide-react';
import { Footer } from '../components/landing/Footer';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/support-config';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

const SELF_SERVICE_LINKS = [
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
  { to: '/terms', label: 'Terms of Use', icon: FileText },
  { to: '/privacy', label: 'Privacy Policy', icon: Shield },
];

export function ContactPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#070b12] text-[#f0f4f8]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.09),transparent_60%)]" />

      <div className="px-4 pb-20 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Lumora
          </Link>

          {/* Hero */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="mx-auto mt-8 max-w-2xl space-y-4 text-center"
          >
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-sky-400">
              <LifeBuoy className="h-3.5 w-3.5" />
              <span>Lumora support</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">How can we help?</h1>
            <p className="mx-auto max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
              For anything about Workspaces, chat, Career Intelligence, or billing — email is the fastest path.
              Found something broken? File a bug report so we can trace exactly what happened.
            </p>
          </motion.div>

          {/* Support cards */}
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              className="group flex flex-col gap-5 rounded-2xl border border-slate-800/70 bg-[#101826]/80 p-6 transition-colors hover:border-sky-700/50"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-800/50 bg-sky-950/40 text-sky-300">
                <Mail className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold text-white">General Support</h2>
                <p className="text-xs leading-relaxed text-slate-400">
                  Questions about your account, a Workspace, billing, or anything else.
                </p>
              </div>
              <a
                href={SUPPORT_MAILTO}
                className="mt-auto inline-flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-sky-700/60 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <span className="truncate">{SUPPORT_EMAIL}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </a>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              transition={{ delay: 0.06 }}
              className="group flex flex-col gap-5 rounded-2xl border border-slate-800/70 bg-[#101826]/80 p-6 transition-colors hover:border-sky-700/50"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-800/50 bg-amber-950/30 text-amber-300">
                <Bug className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold text-white">Report a Problem</h2>
                <p className="text-xs leading-relaxed text-slate-400">
                  Ingestion failures, incorrect citations, payment issues, or anything that looks broken.
                </p>
              </div>
              <Link
                to="/report-bug"
                className="mt-auto inline-flex items-center justify-between gap-2 rounded-lg bg-sky-400 px-3.5 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <span>Report a Bug</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              transition={{ delay: 0.12 }}
              className="flex flex-col gap-5 rounded-2xl border border-slate-800/70 bg-[#101826]/80 p-6 transition-colors hover:border-slate-700/70 sm:col-span-2 lg:col-span-1"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-800/50 bg-violet-950/30 text-violet-300">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold text-white">Self-Service</h2>
                <p className="text-xs leading-relaxed text-slate-400">
                  Answers to common questions, plus how Lumora handles your data.
                </p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {SELF_SERVICE_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <link.icon className="h-3.5 w-3.5" />
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
