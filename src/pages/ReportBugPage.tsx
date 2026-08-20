import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Clipboard, Copy, Mail } from 'lucide-react';
import { Footer } from '../components/landing/Footer';
import { buildSupportMailto, SUPPORT_EMAIL_LABEL } from '../lib/support-config';

const CATEGORIES = [
  'Workspace',
  'Source ingestion',
  'Chat',
  'Citations',
  'Skill Intelligence',
  'Learning Path',
  'Payments',
  'Account',
  'UI / Visual',
  'Other',
] as const;

type Category = (typeof CATEGORIES)[number];

const PRESET_CHIPS: ReadonlyArray<{ emoji: string; label: string; category: Category }> = [
  { emoji: '🛠️', label: 'Workspace', category: 'Workspace' },
  { emoji: '🤖', label: 'Skill Intelligence', category: 'Skill Intelligence' },
  { emoji: '💳', label: 'Billing & Razorpay', category: 'Payments' },
  { emoji: '📄', label: 'Ingestion/RAG', category: 'Source ingestion' },
];

interface BugFormState {
  category: Category;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  pageContext: string;
}

const BLANK_FORM: BugFormState = {
  category: 'Workspace',
  title: '',
  description: '',
  stepsToReproduce: '',
  expectedBehavior: '',
  actualBehavior: '',
  pageContext: '',
};

const baseInputClasses =
  'w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-3 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2';
const inputClasses = `${baseInputClasses} focus:border-cyan-500/80 focus:ring-cyan-500/50`;
const expectedInputClasses = `${baseInputClasses} focus:border-emerald-500/80 focus:ring-emerald-500/30`;
const actualInputClasses = `${baseInputClasses} focus:border-rose-500/80 focus:ring-rose-500/30`;

function buildReportText(form: BugFormState): string {
  const lines = [
    `Category: ${form.category}`,
    `Title: ${form.title}`,
    '',
    'Description:',
    form.description || '(none provided)',
    '',
    'Steps to reproduce:',
    form.stepsToReproduce || '(none provided)',
    '',
    'Expected behavior:',
    form.expectedBehavior || '(none provided)',
    '',
    'Actual behavior:',
    form.actualBehavior || '(none provided)',
  ];
  if (form.pageContext.trim()) {
    lines.push('', `Page / feature: ${form.pageContext.trim()}`);
  }
  return lines.join('\n');
}

function buildMarkdownReport(form: BugFormState): string {
  const lines = [
    `## Bug Report: ${form.title.trim() || '(untitled)'}`,
    '',
    `**Category:** ${form.category}`,
    '',
    '### Description',
    form.description.trim() || '_(none provided)_',
    '',
    '### Steps to Reproduce',
    form.stepsToReproduce.trim() || '_(none provided)_',
    '',
    '### Expected Behavior',
    form.expectedBehavior.trim() || '_(none provided)_',
    '',
    '### Actual Behavior',
    form.actualBehavior.trim() || '_(none provided)_',
  ];
  if (form.pageContext.trim()) {
    lines.push('', `**Page / feature:** ${form.pageContext.trim()}`);
  }
  return lines.join('\n');
}

export function ReportBugPage() {
  const [form, setForm] = useState<BugFormState>(BLANK_FORM);
  const [errors, setErrors] = useState<Partial<Record<'title' | 'description', string>>>({});
  const [prepared, setPrepared] = useState<{ mailtoHref: string; reportText: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [markdownCopied, setMarkdownCopied] = useState(false);

  const update = <K extends keyof BugFormState>(key: K, value: BugFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!form.title.trim()) nextErrors.title = 'A short title is required.';
    if (!form.description.trim()) nextErrors.description = 'Please describe the issue.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const reportText = buildReportText(form);
    const subject = `[Bug] ${form.category}: ${form.title.trim()}`;
    const mailtoHref = buildSupportMailto(subject, reportText);
    setCopied(false);
    setPrepared({ mailtoHref, reportText });
    window.location.href = mailtoHref;
  };

  const handleCopy = async () => {
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText(prepared.reportText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdownReport(form));
      setMarkdownCopied(true);
      setTimeout(() => setMarkdownCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context); the
      // "Prepare report & open email" path still works as a fallback.
    }
  };

  const handleStartOver = () => {
    setForm(BLANK_FORM);
    setErrors({});
    setPrepared(null);
    setCopied(false);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-[#f0f4f8]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
      <div aria-hidden="true" className="dashboard-starfield pointer-events-none fixed inset-0 -z-10 opacity-30" />

      <div className="relative z-10 px-4 pb-16 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <Link
            to="/contact"
            className="group inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md transition-all hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Contact
          </Link>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-950/40 px-3.5 py-1 font-mono text-xs uppercase tracking-[0.18em] text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)] backdrop-blur-md">
              Report a bug
            </div>
            <h1 className="bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
              Tell us what broke
            </h1>
            <p className="max-w-xl text-sm leading-7 text-slate-400">
              Lumora doesn't yet have a ticketing backend, so this form prepares a structured report and opens it as
              an email to {SUPPORT_EMAIL_LABEL} — nothing is silently "submitted" behind the scenes.
            </p>
          </div>

          {!prepared ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-6 rounded-2xl border border-slate-800/80 bg-[#101621]/90 p-8 shadow-2xl backdrop-blur-2xl">
              <div>
                <label htmlFor="bug-category" className="mb-2 block text-xs font-medium text-slate-300">
                  Quick category
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_CHIPS.map((chip) => {
                    const active = form.category === chip.category;
                    return (
                      <button
                        key={chip.category}
                        type="button"
                        onClick={() => update('category', chip.category)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? 'border-cyan-500/60 bg-cyan-950/30 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                            : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-cyan-500/50 hover:bg-slate-800'
                        }`}
                      >
                        <span aria-hidden="true">{chip.emoji}</span>
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="bug-category-select" className="mb-1.5 block text-xs font-medium text-slate-300">
                  Category
                </label>
                <select
                  id="bug-category-select"
                  value={form.category}
                  onChange={(e) => update('category', e.target.value as BugFormState['category'])}
                  className={inputClasses}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bug-title" className="mb-1.5 block text-xs font-medium text-slate-300">
                  Short title <span className="text-rose-400">*</span>
                </label>
                <input
                  id="bug-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="e.g. Citation missing timestamp on YouTube source"
                  className={inputClasses}
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={errors.title ? 'bug-title-error' : undefined}
                />
                {errors.title && (
                  <p id="bug-title-error" className="mt-1.5 text-xs text-rose-400">
                    {errors.title}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="bug-description" className="mb-1.5 block text-xs font-medium text-slate-300">
                  Description <span className="text-rose-400">*</span>
                </label>
                <textarea
                  id="bug-description"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={3}
                  placeholder="What happened?"
                  className={`${inputClasses} resize-none`}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={errors.description ? 'bug-description-error' : undefined}
                />
                {errors.description && (
                  <p id="bug-description-error" className="mt-1.5 text-xs text-rose-400">
                    {errors.description}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="bug-steps" className="mb-1.5 block text-xs font-medium text-slate-300">
                  Steps to reproduce
                </label>
                <textarea
                  id="bug-steps"
                  value={form.stepsToReproduce}
                  onChange={(e) => update('stepsToReproduce', e.target.value)}
                  rows={3}
                  placeholder={'1. Go to…\n2. Click…\n3. See…'}
                  className={`${inputClasses} resize-none`}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="bug-expected" className="mb-1.5 block text-xs font-medium text-slate-300">
                    Expected behavior
                  </label>
                  <textarea
                    id="bug-expected"
                    value={form.expectedBehavior}
                    onChange={(e) => update('expectedBehavior', e.target.value)}
                    rows={2}
                    className={`${expectedInputClasses} resize-none`}
                  />
                </div>
                <div>
                  <label htmlFor="bug-actual" className="mb-1.5 block text-xs font-medium text-slate-300">
                    Actual behavior
                  </label>
                  <textarea
                    id="bug-actual"
                    value={form.actualBehavior}
                    onChange={(e) => update('actualBehavior', e.target.value)}
                    rows={2}
                    className={`${actualInputClasses} resize-none`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bug-context" className="mb-1.5 block text-xs font-medium text-slate-300">
                  Page or feature (optional)
                </label>
                <input
                  id="bug-context"
                  type="text"
                  value={form.pageContext}
                  onChange={(e) => update('pageContext', e.target.value)}
                  placeholder="e.g. /workspaces/… or Learning Path"
                  className={inputClasses}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-medium text-white shadow-md transition-all hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 active:scale-[0.99]"
                >
                  <Mail className="h-4 w-4" />
                  Prepare report &amp; open email
                </button>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                >
                  {markdownCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}
                  {markdownCopied ? 'Copied to clipboard!' : 'Copy Raw Markdown Report'}
                </button>
              </div>
            </form>
          ) : (
            <div className="animate-fade-in space-y-5 rounded-2xl border border-emerald-800/40 bg-emerald-950/10 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-800/50 bg-emerald-950/40 text-emerald-300">
                  <Check className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-white">Report prepared</h2>
                  <p className="text-xs leading-relaxed text-slate-400">
                    Your email client should have opened with this report addressed to {SUPPORT_EMAIL_LABEL}. If it didn't
                    open — no mail client configured, for example — copy the report below and send it yourself.
                  </p>
                </div>
              </div>

              <pre className="max-h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-[11px] leading-relaxed text-slate-300">
                {prepared.reportText}
              </pre>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-sky-700/70 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy report'}
                </button>
                <a
                  href={prepared.mailtoHref}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Open email client again
                </a>
                <button
                  type="button"
                  onClick={handleStartOver}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  Report another issue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
