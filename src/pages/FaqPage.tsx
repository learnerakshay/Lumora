import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Footer } from '../components/landing/Footer';

interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'workspaces',
    title: 'Workspaces & sources',
    items: [
      {
        question: 'What is a Workspace?',
        answer:
          'A Workspace is where you collect sources on a topic and chat about them. Each Workspace — and everything inside it — is private to your account.',
      },
      {
        question: 'What can I add to a Workspace?',
        answer: 'PDFs, websites, YouTube videos, VTT/transcript files, and plain text or Markdown notes.',
      },
    ],
  },
  {
    id: 'chat',
    title: 'GENERAL vs. GROUNDED answers',
    items: [
      {
        question: "What's the difference between a GENERAL and a GROUNDED answer?",
        answer:
          'A GENERAL answer comes from the model\'s own knowledge, with no citations. A GROUNDED answer is built from evidence retrieved from your Workspace sources and includes citations back to where each claim came from.',
      },
      {
        question: 'Why did my question get a GENERAL answer even though I have sources?',
        answer:
          "Retrieval finds candidate passages, but Lumora only answers GROUNDED when what it found actually covers what you asked. If your sources don't cover the topic, you get an honest GENERAL answer instead of a confident-sounding guess.",
      },
      {
        question: 'What do citations point to?',
        answer:
          'A page number for PDFs, a section for websites, or a timestamp for YouTube/VTT sources — always the specific passage the answer was built from, never a fabricated reference.',
      },
    ],
  },
  {
    id: 'career-intelligence',
    title: 'Career Intelligence',
    items: [
      {
        question: 'What does the resume-to-learning-path flow actually do?',
        answer:
          'Upload a resume or paste its text, and Lumora extracts your skills with supporting evidence, matches you against a handful of target roles, and produces an explainable, evidence-based gap analysis — each gap tied to a specific role requirement, not a guess.',
      },
      {
        question: 'How do I get a learning path?',
        answer:
          'From your gap analysis, select the gaps you want to close (up to six at a time). Lumora builds a staged plan — why each step matters, what to learn, and how to prove it — plus a Career Readiness report.',
      },
      {
        question: 'Can I turn a learning path into a Workspace?',
        answer:
          'Yes. A learning plan can create a dedicated, empty Learning Workspace you then fill with your own sources as you work through it.',
      },
    ],
  },
  {
    id: 'plans',
    title: 'Plans & payments',
    items: [
      {
        question: 'How does Lumora pricing work?',
        answer: (
          <>
            FREE, CORE, and MAX are one-time purchases with 30 days of access — not subscriptions. See the{' '}
            <Link to="/pricing" className="text-cyan-300 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-200">
              pricing page
            </Link>{' '}
            for exact limits and the full payments FAQ.
          </>
        ),
      },
      {
        question: 'What happens when my access expires?',
        answer:
          'You drop back to FREE limits (or a lower plan you still have unexpired access to). Nothing is deleted — only the higher usage capacity ends until you renew.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy',
    items: [
      {
        question: 'Is my Workspace content private?',
        answer:
          "Yes. Every Workspace, source, and chat is scoped to your account and isolated from other users. See our Privacy Policy for what's processed and which third-party providers are involved.",
      },
    ],
  },
];

export function FaqPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#070b12] text-[#f0f4f8]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.07),transparent_60%)]" />

      <div className="px-4 pb-16 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-11">
          <div className="space-y-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-sky-400">
              <span>FAQ</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Frequently asked questions</h1>
            <p className="text-sm text-slate-400 sm:text-base">
              How Workspaces, grounded answers, Career Intelligence, and plans work.
            </p>
          </div>

          {FAQ_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`faq-${group.id}`} className="space-y-4">
              <h2 id={`faq-${group.id}`} className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </h2>
              <div className="space-y-2.5">
                {group.items.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-2xl border border-slate-800/90 bg-[#101826]/95 transition-colors open:border-cyan-400/25 open:bg-cyan-400/[0.03]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                      {item.question}
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180 group-open:text-cyan-300" />
                    </summary>
                    <div className="px-5 pb-5 text-xs leading-relaxed text-slate-400">{item.answer}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}

          <p className="text-center text-xs text-slate-500">
            Still have a question?{' '}
            <Link to="/contact" className="font-medium text-cyan-300 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-200">
              Contact us
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
