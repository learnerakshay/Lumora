import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bug, Check, FileText, HelpCircle, LifeBuoy, Mail, Search, Shield } from 'lucide-react';
import { Footer } from '../components/landing/Footer';
import { SUPPORT_EMAIL } from '../lib/support-config';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

const SELF_SERVICE_LINKS = [
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
  { to: '/terms', label: 'Terms of Use', icon: FileText },
  { to: '/privacy', label: 'Privacy Policy', icon: Shield },
];

type SystemStatus = 'checking' | 'operational' | 'degraded';

// A real check against the same health endpoint ops uses, not a hardcoded
// "all good" badge — it reflects actual database + vector-index readiness.
function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>('checking');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? 'operational' : 'degraded');
      })
      .catch(() => {
        if (!cancelled) setStatus('degraded');
      });
    return () => { cancelled = true; };
  }, []);
  return status;
}

export function ContactPage() {
  const systemStatus = useSystemStatus();
  const [emailCopied, setEmailCopied] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context); the
      // mailto link below still works as a fallback.
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-[#f0f4f8]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
      <div aria-hidden="true" className="dashboard-starfield pointer-events-none fixed inset-0 -z-10 opacity-30" />

      <div className="relative z-10 px-4 pb-20 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md transition-all hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 font-mono text-xs uppercase tracking-wider text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] backdrop-blur-md">
              <LifeBuoy className="h-3.5 w-3.5" />
              <span>Lumora support</span>
            </div>

            <div>
              {systemStatus === 'checking' ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-400 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  Checking system status…
                </span>
              ) : systemStatus === 'operational' ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-slate-900/80 px-3 py-1 text-xs text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)] backdrop-blur-md">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  All Systems Operational — Database &amp; Retrieval Healthy
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-slate-900/80 px-3 py-1 text-xs text-amber-400 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Degraded Performance Detected
                </span>
              )}
            </div>

            <h1 className="bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
              How can we help?
            </h1>
            <p className="mx-auto max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
              For anything about Workspaces, chat, Career Intelligence, or billing — email is the fastest path.
              Found something broken? File a bug report so we can trace exactly what happened.
            </p>

            <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-400 shadow-lg backdrop-blur-md transition-all focus-within:border-cyan-500/50">
              <span className="flex min-w-0 items-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search support guides or error codes…"
                  className="min-w-0 flex-1 bg-transparent text-left text-slate-300 placeholder:text-slate-500 focus:outline-none"
                />
              </span>
              <kbd className="shrink-0 rounded-md border border-slate-700 bg-slate-950/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">⌘K</kbd>
            </div>
          </motion.div>

          {/* Support cards */}
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              className="group relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]"
            >
              <div>
                <div className="w-fit rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="mt-4 space-y-1.5">
                  <h2 className="text-sm font-semibold text-white">General Support</h2>
                  <p className="text-xs leading-relaxed text-slate-400">
                    Questions about your account, a Workspace, billing, or anything else.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="mt-auto inline-flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-cyan-700/60 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span className="truncate">{emailCopied ? 'Copied!' : SUPPORT_EMAIL}</span>
                {emailCopied ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              transition={{ delay: 0.06 }}
              className="group relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-rose-500/50 hover:shadow-[0_0_25px_rgba(244,63,94,0.15)]"
            >
              <div>
                <div className="w-fit rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-400">
                  <Bug className="h-5 w-5" />
                </div>
                <div className="mt-4 space-y-1.5">
                  <h2 className="text-sm font-semibold text-white">Report a Problem</h2>
                  <p className="text-xs leading-relaxed text-slate-400">
                    Ingestion failures, incorrect citations, payment issues, or anything that looks broken.
                  </p>
                </div>
              </div>
              <Link
                to="/report-bug"
                className="mt-auto inline-flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-medium text-white shadow-md transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <span>Report a Bug</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              transition={{ delay: 0.12 }}
              className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-[0_0_25px_rgba(139,92,246,0.15)] sm:col-span-2 lg:col-span-1"
            >
              <div>
                <div className="w-fit rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-violet-400">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div className="mt-4 space-y-1.5">
                  <h2 className="text-sm font-semibold text-white">Self-Service</h2>
                  <p className="text-xs leading-relaxed text-slate-400">
                    Answers to common questions, plus how Lumora handles your data.
                  </p>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {SELF_SERVICE_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 p-2.5 text-xs font-medium text-slate-300 transition-all hover:border-violet-500/50 hover:bg-violet-950/20 hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
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

      <div className="relative z-10 overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
