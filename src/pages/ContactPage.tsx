import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bug, FileText, HelpCircle, LifeBuoy, Mail, Search, Shield } from 'lucide-react';
import { Footer } from '../components/landing/Footer';
import { SUPPORT_EMAIL_LABEL, SUPPORT_MAILTO } from '../lib/support-config';
import { searchSupportContent, type SupportSearchEntry } from '../lib/support-search';

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
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRootRef = useRef<HTMLDivElement>(null);
  const searchResults = useMemo(() => searchSupportContent(query), [query]);

  useEffect(() => {
    setActiveResultIndex(-1);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(Boolean(query.trim()));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [query]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!searchRootRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  const openSearchResult = (result: SupportSearchEntry) => {
    setSearchOpen(false);
    navigate(result.to);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchOpen(true);
      setActiveResultIndex((current) => (searchResults.length ? (current + 1) % searchResults.length : -1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchOpen(true);
      setActiveResultIndex((current) =>
        searchResults.length ? (current <= 0 ? searchResults.length - 1 : current - 1) : -1,
      );
      return;
    }

    if (event.key === 'Enter' && searchResults.length > 0) {
      event.preventDefault();
      openSearchResult(searchResults[activeResultIndex >= 0 ? activeResultIndex : 0]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOpen(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0b0f17] text-[#f0f4f8]">
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
            className="mx-auto mt-9 max-w-3xl text-center"
          >
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 font-mono text-xs uppercase tracking-wider text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] backdrop-blur-md">
              <LifeBuoy className="h-3.5 w-3.5" />
              <span>Lumora support</span>
            </div>

            <h1 className="mt-5 bg-gradient-to-r from-white via-cyan-100 to-sky-300 bg-clip-text text-4xl font-extrabold tracking-[-0.035em] text-transparent sm:text-5xl lg:text-6xl">
              How can we help?
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              For anything about Workspaces, chat, Career Intelligence, or billing — email is the fastest path.
              Found something broken? File a bug report so we can trace exactly what happened.
            </p>

            <div ref={searchRootRef} className="relative mx-auto mt-8 max-w-2xl text-left">
              <div
                className={`flex min-h-14 items-center gap-3 border bg-[#101826]/95 px-4 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
                  searchOpen && query.trim()
                    ? 'rounded-t-2xl border-cyan-400/45 shadow-[0_0_26px_rgba(0,242,254,0.1)]'
                    : 'rounded-2xl border-slate-700/90 focus-within:border-cyan-400/60 focus-within:shadow-[0_0_28px_rgba(0,242,254,0.12)]'
                }`}
              >
                <Search className="h-5 w-5 shrink-0 text-cyan-300" strokeWidth={1.8} />
                <label htmlFor="support-search" className="sr-only">Search Lumora support</label>
                <input
                  id="support-search"
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSearchOpen(Boolean(event.target.value.trim()));
                  }}
                  onFocus={() => setSearchOpen(Boolean(query.trim()))}
                  onKeyDown={handleSearchKeyDown}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={searchOpen && Boolean(query.trim())}
                  aria-controls="support-search-results"
                  aria-activedescendant={activeResultIndex >= 0 ? `support-result-${searchResults[activeResultIndex]?.id}` : undefined}
                  autoComplete="off"
                  placeholder="Search Workspaces, sources, chat, billing…"
                  className="min-w-0 flex-1 bg-transparent py-4 text-left text-sm text-white placeholder:text-slate-500 focus:outline-none sm:text-base"
                />
                <kbd className="hidden shrink-0 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 font-mono text-[10px] text-slate-500 sm:inline-flex">Ctrl / ⌘ K</kbd>
              </div>

              <AnimatePresence>
                {searchOpen && query.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="absolute inset-x-0 top-full z-40 overflow-hidden rounded-b-2xl border border-t-0 border-cyan-400/35 bg-[#0e1623]/[0.98] shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
                  >
                    {searchResults.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Results</span>
                          <span className="text-[10px] text-slate-600">Use ↑ ↓ and Enter</span>
                        </div>
                        <div id="support-search-results" role="listbox" className="max-h-[min(25rem,60vh)] overflow-y-auto p-2">
                          {searchResults.map((result, index) => {
                            const active = index === activeResultIndex;
                            return (
                              <button
                                id={`support-result-${result.id}`}
                                key={result.id}
                                type="button"
                                role="option"
                                aria-selected={active}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() => setActiveResultIndex(index)}
                                onClick={() => openSearchResult(result)}
                                className={`group/result flex w-full items-start justify-between gap-4 rounded-xl px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 ${
                                  active ? 'bg-cyan-400/10' : 'hover:bg-slate-800/75'
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/80">{result.category}</span>
                                  <span className="mt-1 block text-sm font-semibold text-slate-100">{result.title}</span>
                                  <span className="mt-1 block text-xs leading-5 text-slate-400">{result.description}</span>
                                </span>
                                <ArrowRight className={`mt-5 h-4 w-4 shrink-0 text-slate-600 transition-all ${active ? 'translate-x-0.5 text-cyan-300' : 'group-hover/result:translate-x-0.5 group-hover/result:text-slate-300'}`} />
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div id="support-search-results" role="status" className="px-5 py-7 text-center">
                        <p className="text-sm font-semibold text-slate-200">No support article found.</p>
                        <p className="mt-1.5 text-xs text-slate-500">
                          Try another search or{' '}
                          <a href={SUPPORT_MAILTO} className="rounded-sm text-cyan-300 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                            contact Lumora Support
                          </a>
                          .
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Support cards */}
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              className="group relative flex min-h-64 flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-slate-800/90 bg-[#101826]/80 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/35"
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
              <a
                href={SUPPORT_MAILTO}
                className="mt-auto inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3.5 py-2.5 text-xs font-semibold text-slate-100 transition-colors hover:border-cyan-400/45 hover:bg-cyan-400/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span className="truncate">{SUPPORT_EMAIL_LABEL}</span>
                <Mail className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
              </a>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              transition={{ delay: 0.06 }}
              className="group relative flex min-h-64 flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-slate-800/90 bg-[#101826]/80 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-400/30"
            >
              <div>
                <div className="w-fit rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-3 text-rose-300">
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
                className="mt-auto inline-flex min-h-11 items-center justify-between gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-semibold text-slate-950 shadow-md transition-all hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
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
              className="relative flex min-h-64 flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-slate-800/90 bg-[#101826]/80 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-400/30 sm:col-span-2 lg:col-span-1"
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

          <p className="mt-7 text-center text-xs text-slate-500">
            Need a human?{' '}
            <a href={SUPPORT_MAILTO} className="rounded-sm font-medium text-cyan-300 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
              Email Lumora Support
            </a>
            .
          </p>
        </div>
      </div>

      <div className="relative z-10 overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
