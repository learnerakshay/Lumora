import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Brain,
  FileSearch,
  FolderPlus,
  GraduationCap,
  ListChecks,
  ListOrdered,
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

// Decorative twinkling nodes concentrated toward the outer margins, where
// the wide max-w containers otherwise leave long stretches of flat black on
// large viewports. Positioned as percentages of the full page height (this
// layer is absolutely positioned against <main>, not the viewport), so they
// scroll naturally with the page instead of repeating in one fixed band.
const STAR_NODES: ReadonlyArray<{ left: string; top: string; size: number; delay: string }> = [
  { left: '3%', top: '4%', size: 2, delay: '0s' },
  { left: '8%', top: '14%', size: 1, delay: '0.6s' },
  { left: '2%', top: '26%', size: 2, delay: '1.4s' },
  { left: '6%', top: '38%', size: 1, delay: '2.1s' },
  { left: '4%', top: '52%', size: 2, delay: '0.3s' },
  { left: '9%', top: '64%', size: 1, delay: '1.8s' },
  { left: '3%', top: '76%', size: 2, delay: '2.6s' },
  { left: '7%', top: '88%', size: 1, delay: '0.9s' },
  { left: '5%', top: '96%', size: 2, delay: '1.2s' },
  { left: '96%', top: '6%', size: 1, delay: '0.4s' },
  { left: '92%', top: '18%', size: 2, delay: '1.6s' },
  { left: '97%', top: '30%', size: 1, delay: '2.3s' },
  { left: '93%', top: '44%', size: 2, delay: '0.8s' },
  { left: '98%', top: '56%', size: 1, delay: '1.9s' },
  { left: '94%', top: '68%', size: 2, delay: '0.2s' },
  { left: '96%', top: '80%', size: 1, delay: '2.7s' },
  { left: '91%', top: '92%', size: 2, delay: '1.1s' },
  { left: '95%', top: '98%', size: 1, delay: '0.5s' },
];

const CAREER_STEPS = [
  { icon: FileSearch, label: 'Resume / CV', body: 'Upload a resume or paste its text.' },
  { icon: Brain, label: 'Skill Understanding', body: 'Lumora extracts your skills and the evidence behind each one.' },
  { icon: Target, label: 'Role-Fit Analysis', body: 'Your profile is matched against target roles with an explainable fit score.' },
  { icon: ListChecks, label: 'Gap Detection', body: 'Missing or weak skills surface as specific, evidence-based gaps — not guesses.' },
  { icon: ListOrdered, label: 'Gap Prioritization', body: 'Select the gaps that matter most; Lumora ranks them by severity and impact.' },
  { icon: GraduationCap, label: 'Gap Filling / Learning Path', body: 'A staged plan — why it matters, what to learn, and how to prove it — is built from your selection.' },
  { icon: BookOpen, label: 'Recommended Resources', body: 'Courses, cohorts, and projects matched to each step, from the same Resource Intelligence used across Lumora.' },
  { icon: FolderPlus, label: 'Learning Workspace', body: 'Turn the plan into a dedicated Workspace and keep building evidence as you close each gap.' },
];

export function AboutPage() {
  const { isSignedIn } = useAuth();

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-[#f0f4f8]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
      <div aria-hidden="true" className="dashboard-starfield pointer-events-none fixed inset-0 -z-10 opacity-60" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {STAR_NODES.map((star, index) => (
          <span
            key={index}
            className="about-star-node"
            style={{ left: star.left, top: star.top, width: star.size, height: star.size, animationDelay: star.delay }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {/* Intro */}
        <section className="relative px-4 pb-16 pt-20 sm:px-6 lg:px-8">
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-12 z-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="relative z-10 mx-auto max-w-3xl space-y-5 text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 font-mono text-xs uppercase tracking-wider text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] backdrop-blur-md">
              <span>About Lumora</span>
            </div>
            <h1 className="bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
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
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Pillar one</p>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Grounded Knowledge Workspace</h2>
              <p className="text-sm text-slate-400">
                Every Workspace is isolated to you. Chat answers either from general model knowledge, or — only when
                retrieved evidence genuinely covers what you asked — from your own sources, with citations back to the
                exact page, section, or timestamp.
              </p>
            </motion.div>

            <div className="relative mt-10">
              <span aria-hidden="true" className="pipeline-beam absolute left-0 right-0 top-11 hidden w-full sm:block">
                <span className="pipeline-beam-fill" />
              </span>
              <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-3">
                {WORKSPACE_STEPS.map((step, index) => (
                  <motion.div
                    key={step.title}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-60px' }}
                    variants={fadeUp}
                    transition={{ delay: index * 0.06 }}
                    className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]"
                  >
                    <div className="w-fit rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-400">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{step.body}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pillar 2 — Career Intelligence */}
        <section className="relative px-4 py-16 sm:px-6 lg:px-8">
          <div aria-hidden="true" className="pointer-events-none absolute bottom-1/3 left-1/2 z-0 h-[350px] w-[700px] -translate-x-1/2 rounded-full bg-violet-500/10 blur-[140px]" />
          <div className="relative z-10 mx-auto max-w-6xl">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="mx-auto max-w-2xl space-y-3 text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Pillar two</p>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Career Intelligence</h2>
              <p className="text-sm text-slate-400">
                Lumora's second capability turns a resume into a plan: where you are today, where a target role expects
                you to be, and the specific, evidence-backed steps that close the distance — not a generic "resume
                analyzer," a full progression from profile to role-readiness.
              </p>
            </motion.div>

            {/* Pipeline — responsive grid/timeline, never a horizontally scrolling strip */}
            <div className="relative mt-10">
              {/* Vertical connector for the single-column mobile timeline */}
              <div
                aria-hidden="true"
                className="absolute bottom-6 left-[22px] top-6 w-px bg-gradient-to-b from-violet-800/50 via-slate-800 to-transparent sm:hidden"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {CAREER_STEPS.map((step, index) => (
                  <motion.div
                    key={step.label}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-60px' }}
                    variants={fadeUp}
                    transition={{ delay: index * 0.04 }}
                    className="relative flex cursor-pointer gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 shadow-md backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:bg-slate-900/80 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] sm:flex-col sm:gap-3 sm:p-5"
                  >
                    <div className="relative z-10 w-fit shrink-0 rounded-xl bg-violet-500/10 p-2.5 text-violet-400">
                      <step.icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-xs text-violet-300">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-xs font-semibold text-white">{step.label}</h3>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{step.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              className="relative mx-auto mt-8 max-w-2xl overflow-hidden rounded-2xl border border-slate-800 border-l-4 border-l-cyan-500 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-2xl"
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cyan-500/5 blur-3xl" />
              <div className="relative flex items-start gap-3 text-left">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <p className="text-xs leading-relaxed text-slate-300">
                  Every gap Lumora surfaces is explainable — tied to a specific role requirement and the evidence (or
                  absence of evidence) found in your profile, ranked by severity so you know what to close first.
                  Recommended resources and projects point to the same Resource Intelligence used across Lumora, and a
                  plan can become its own Learning Workspace so you keep gathering evidence as you go.
                </p>
              </div>
            </motion.div>

            <div className="relative mx-auto mt-8 flex w-fit items-center justify-center">
              <span aria-hidden="true" className="absolute inset-0 -z-10 animate-pulse rounded-xl bg-cyan-500/20 blur-xl" />
              <Link
                to={isSignedIn ? '/skills' : '/sign-in'}
                className="mx-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-medium text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 active:scale-[0.98]"
              >
                {isSignedIn ? 'Open Skill Intelligence' : 'Try Career Intelligence'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="relative z-10 overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
