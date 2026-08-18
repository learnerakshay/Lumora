import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Brain,
  FileSearch,
  FolderPlus,
  GraduationCap,
  ListChecks,
  MessageCircle,
  Quote,
  Target,
  Upload,
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { Footer } from '../components/landing/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

const WORKSPACE_STEPS = [
  {
    icon: Upload,
    title: 'Collect',
    body: 'Add PDFs, websites, YouTube videos, VTT transcripts, or plain text into an isolated Workspace.',
  },
  {
    icon: Brain,
    title: 'Understand',
    body: 'Lumora chunks and indexes your material so the right passages surface for each question you ask.',
  },
  {
    icon: MessageCircle,
    title: 'Transform',
    body: 'Chat freely on general knowledge, or ask about your sources and get an answer with citations back to the exact passage.',
  },
];

const CAREER_STEPS = [
  { icon: FileSearch, label: 'Resume / CV', body: 'Upload a resume or paste its text.' },
  { icon: Brain, label: 'Skill understanding', body: 'Lumora extracts your skills and the evidence behind each one.' },
  { icon: Target, label: 'Role-fit analysis', body: 'Your profile is matched against target roles with an explainable fit score.' },
  { icon: ListChecks, label: 'Gap detection', body: 'Missing or weak skills surface as specific, evidence-based gaps — not guesses.' },
  { icon: ListChecks, label: 'Gap prioritization', body: 'Select the gaps that matter most; Lumora ranks them by severity and impact.' },
  { icon: GraduationCap, label: 'Learning path', body: 'A staged plan — why it matters, what to learn, and how to prove it — is built from your selection.' },
  { icon: FolderPlus, label: 'Learning Workspace', body: 'Turn the plan into a dedicated Workspace and keep building evidence as you close each gap.' },
];

export function AboutPage() {
  const { isSignedIn } = useAuth();

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#070b12] text-[#f0f4f8]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.08),transparent_60%)]" />

      {/* Intro */}
      <section className="px-4 pb-16 pt-20 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="mx-auto max-w-3xl space-y-5 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-sky-400">
            <span>About Lumora</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            One Workspace. Two ways to get sharper.
          </h1>
          <p className="text-sm leading-relaxed text-slate-400 sm:text-base">
            Lumora is an AI knowledge Workspace built around one rule: retrieval finds candidate evidence, but Lumora
            decides whether that evidence is actually enough before it answers. Bring in sources and ask grounded,
            cited questions — or bring in your resume and get a role-fit, gap-aware path to where you want to be.
          </p>
        </motion.div>
      </section>

      {/* Pillar 1 — Grounded Workspace */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="mx-auto max-w-2xl space-y-3 text-center"
          >
            <p className="font-mono text-xs uppercase tracking-wider text-sky-400">Pillar one</p>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Grounded Knowledge Workspace</h2>
            <p className="text-sm text-slate-400">
              Every Workspace is isolated to you. Chat answers either from general model knowledge, or — only when
              retrieved evidence genuinely covers what you asked — from your own sources, with citations back to the
              exact page, section, or timestamp.
            </p>
          </motion.div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {WORKSPACE_STEPS.map((step, index) => (
              <motion.div
                key={step.title}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                transition={{ delay: index * 0.06 }}
                className="rounded-2xl border border-slate-800/70 bg-[#101826]/80 p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-sky-400">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillar 2 — Career Intelligence */}
      <section className="relative px-4 py-16 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-72 -translate-y-1/2 bg-[radial-gradient(circle_at_50%_50%,rgba(129,140,248,0.06),transparent_60%)]" />
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="mx-auto max-w-2xl space-y-3 text-center"
          >
            <p className="font-mono text-xs uppercase tracking-wider text-violet-300">Pillar two</p>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Career Intelligence</h2>
            <p className="text-sm text-slate-400">
              Lumora's second capability turns a resume into a plan: where you are today, where a target role expects
              you to be, and the specific, evidence-backed steps that close the distance — not a generic "resume
              analyzer," a full progression from profile to role-readiness.
            </p>
          </motion.div>

          {/* Pipeline */}
          <div className="mt-10 overflow-x-auto">
            <div className="mx-auto flex min-w-[760px] max-w-5xl items-stretch gap-3 lg:min-w-0">
              {CAREER_STEPS.map((step, index) => (
                <React.Fragment key={step.label}>
                  <motion.div
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-60px' }}
                    variants={fadeUp}
                    transition={{ delay: index * 0.05 }}
                    className="flex w-40 shrink-0 flex-col gap-3 rounded-2xl border border-slate-800/70 bg-[#101826]/80 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-800/50 bg-violet-950/40 text-violet-300">
                        <step.icon className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-[10px] text-slate-600">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">{step.label}</h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{step.body}</p>
                    </div>
                  </motion.div>
                  {index < CAREER_STEPS.length - 1 && (
                    <div className="flex shrink-0 items-center text-slate-700" aria-hidden="true">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 text-left"
          >
            <Quote className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
            <p className="text-xs leading-relaxed text-slate-400">
              Every gap Lumora surfaces is explainable — tied to a specific role requirement and the evidence (or
              absence of evidence) found in your profile, ranked by severity so you know what to close first.
              Recommended resources and projects point to the same Resource Intelligence used across Lumora, and a
              plan can become its own Learning Workspace so you keep gathering evidence as you go.
            </p>
          </motion.div>

          <div className="mt-8 flex justify-center">
            <Link
              to={isSignedIn ? '/skills' : '/sign-in'}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-5 py-2.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-300 hover:shadow-sky-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              {isSignedIn ? 'Open Skill Intelligence' : 'Try Career Intelligence'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <div className="relative overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
