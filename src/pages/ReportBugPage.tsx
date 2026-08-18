import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Mail } from 'lucide-react';
import { Footer } from '../components/landing/Footer';
import { SUPPORT_EMAIL } from '../lib/support-config';

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

interface BugFormState {
  category: (typeof CATEGORIES)[number];
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

const inputClasses =
  'w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

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

export function ReportBugPage() {
  const [form, setForm] = useState<BugFormState>(BLANK_FORM);
  const [errors, setErrors] = useState<Partial<Record<'title' | 'description', string>>>({});
  const [prepared, setPrepared] = useState<{ mailtoHref: string; reportText: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
    const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reportText)}`;
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

  const handleStartOver = () => {
    setForm(BLANK_FORM);
    setErrors({});
    setPrepared(null);
    setCopied(false);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#070b12] text-[#f0f4f8]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.07),transparent_60%)]" />

      <div className="px-4 pb-16 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-8">
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Contact
          </Link>

          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-sky-400">Report a bug</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Tell us what broke</h1>
            <p className="max-w-xl text-sm leading-7 text-slate-400">
              Lumora doesn't yet have a ticketing backend, so this form prepares a structured report and opens it as
              an email to {SUPPORT_EMAIL} — nothing is silently "submitted" behind the scenes.
            </p>
          </div>

          {!prepared ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-slate-800/70 bg-[#101826]/80 p-6">
              <div>
                <label htmlFor="bug-category" className="mb-1.5 block text-xs font-medium text-slate-300">
                  Category
                </label>
                <select
                  id="bug-category"
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
                  Short title <span className="text-red-400">*</span>
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
                  <p id="bug-title-error" className="mt-1.5 text-xs text-red-400">
                    {errors.title}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="bug-description" className="mb-1.5 block text-xs font-medium text-slate-300">
                  Description <span className="text-red-400">*</span>
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
                  <p id="bug-description-error" className="mt-1.5 text-xs text-red-400">
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
                    className={`${inputClasses} resize-none`}
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
                    className={`${inputClasses} resize-none`}
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

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:w-auto"
              >
                <Mail className="h-4 w-4" />
                Prepare report &amp; open email
              </button>
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
                    Your email client should have opened with this report addressed to {SUPPORT_EMAIL}. If it didn't
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

      <div className="relative overflow-hidden border-t border-slate-800/40">
        <Footer />
      </div>
    </main>
  );
}
