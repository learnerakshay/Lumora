import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Reveal } from './motion/Reveal';
import { Stagger } from './motion/Stagger';
import { useReducedMotion } from './motion/useReducedMotion';
import { CitationTag } from './CitationTag';

interface ShowcaseScenario {
  id: string;
  tabLabel: string;
  question: string;
  answer: string;
  code?: { label: string; lines: string[] };
  citation: { source: string; coordinate: string; excerpt: string; score: string };
  contextTitle: string;
  contextExcerpt: string;
}

// Three real scenarios the same mock frame re-hydrates with — each pairs a
// question with an answer, a citation, and the context-panel excerpt it
// actually traces back to, so switching tabs demonstrates different grounded
// behaviors rather than just re-skinning the same screenshot.
const SCENARIOS: ShowcaseScenario[] = [
  {
    id: 'synthesis',
    tabLabel: 'Cross-Source Synthesis',
    question: 'What is the strongest finding across my sources?',
    answer:
      "The evidence converges on one key insight: retrieval alone isn't enough — sufficiency has to be judged before an answer can be called grounded.",
    citation: { source: 'Research.pdf', coordinate: 'Page 3', excerpt: 'Sufficiency of retrieved evidence must be assessed before an answer is treated as grounded, not assumed from the presence of chunks alone.', score: '0.91 match' },
    contextTitle: 'Research.pdf',
    contextExcerpt: '"...sufficiency of retrieved evidence must be assessed before an answer is treated as grounded, not assumed from the presence of chunks alone."',
  },
  {
    id: 'conflict',
    tabLabel: 'Conflict Detection',
    question: 'Do my sources agree on the ingestion chunk size?',
    answer:
      'They disagree. Research.pdf recommends 800-token chunks, while docs.ai/specs specifies 1,200 characters with 200 characters of overlap. Lumora surfaces both instead of silently picking one.',
    citation: { source: 'docs.ai/specs', coordinate: 'Section 2', excerpt: 'Chunks default to 1,200 characters with 200 characters of overlap between adjacent chunks.', score: '0.88 match' },
    contextTitle: 'docs.ai/specs',
    contextExcerpt: '"...chunks default to 1,200 characters with 200 characters of overlap between adjacent chunks..."',
  },
  {
    id: 'codegen',
    tabLabel: 'API Code Generation',
    question: 'Generate a fetch call that matches the webhook spec in my docs.',
    answer: 'docs.ai/specs signs requests with HMAC-SHA256 over the raw body — here is a fetch call matching that exact shape:',
    code: {
      label: 'verify-webhook.ts',
      lines: [
        "const signature = req.headers['x-signature'];",
        'const expected = createHmac(\'sha256\', WEBHOOK_SECRET)',
        '  .update(rawBody)',
        '  .digest(\'hex\');',
        'if (!timingSafeEqual(signature, expected)) throw new Error(\'Invalid signature\');',
      ],
    },
    citation: { source: 'docs.ai/specs', coordinate: 'Section 4', excerpt: 'Requests are signed with HMAC-SHA256 over the raw body; verify the signature before parsing the payload as JSON.', score: '0.90 match' },
    contextTitle: 'docs.ai/specs',
    contextExcerpt: '"...requests are signed with HMAC-SHA256 over the raw body; verify the signature before parsing the payload as JSON."',
  },
];

// There is currently no product screenshot of the real Workspace UI in this
// repo, and this session's Browser pane cannot capture one (it doesn't
// composite frames — confirmed elsewhere in this project). The frame below
// is an authentic-to-the-product HTML/CSS mock (same chat + citation +
// context-panel pattern used throughout the rest of the landing page) so
// the section reads as intentional rather than broken, with a real <img>
// left commented directly where it belongs once a screenshot exists.
export function ProductShowcaseSection() {
  const frameRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [tilted, setTilted] = useState(!reducedMotion);
  const [activeId, setActiveId] = useState<string>(SCENARIOS[0].id);
  const [copied, setCopied] = useState(false);
  const scenario = SCENARIOS.find((entry) => entry.id === activeId) ?? SCENARIOS[0];

  useEffect(() => {
    if (reducedMotion) return;
    const el = frameRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTilted(false);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    setCopied(false);
  }, [activeId]);

  const handleCopy = async () => {
    if (!scenario.code) return;
    try {
      await navigator.clipboard.writeText(scenario.code.lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied by the browser — fail silently, the
      // code is still fully selectable/readable in the block itself.
    }
  };

  return (
    <section className="landing-section relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-950/16 blur-[130px]" />

      <div className="relative z-10 mx-auto max-w-5xl space-y-8">
        <Reveal as="div" className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-sky-400">
            <span>See it working</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">This is what a grounded answer looks like.</h2>
        </Reveal>

        {/* Scenario switcher */}
        <div role="tablist" aria-label="Workspace scenario" className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2">
          {SCENARIOS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === activeId}
              onClick={() => setActiveId(entry.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                entry.id === activeId
                  ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {entry.tabLabel}
            </button>
          ))}
        </div>

        <div className="product-shot-stage" style={{ perspective: '1200px' }}>
          <div ref={frameRef} className={`product-shot-frame ${tilted ? 'is-tilted' : ''}`}>
            {/* Mock browser chrome */}
            <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-white/[0.08] bg-[#0d1420] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600" aria-hidden="true" />
              <span className="ml-3 rounded-full bg-slate-900 px-3 py-1 font-mono text-[10px] text-slate-500">
                www.getlumora.in/workspace
              </span>
            </div>

            {/*
              TODO: replace placeholder — swap the mock panes below for a
              real screenshot once one exists, e.g.:
              <img
                src="/product/workspace-chat.png"
                alt="Lumora Workspace showing a streamed, grounded chat answer with an inline citation and the source context panel"
                width={1200}
                height={720}
                loading="lazy"
                decoding="async"
                className="block w-full rounded-b-xl border border-white/[0.08]"
              />
            */}
            <div role="tabpanel" className="grid grid-cols-1 gap-px overflow-hidden rounded-b-xl border border-white/[0.08] bg-white/[0.03] sm:grid-cols-[1.6fr_1fr]">
              <div className="space-y-4 bg-[#0b0f17] p-6">
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm border border-sky-800/40 bg-sky-500/15 px-4 py-2.5 text-xs text-sky-100">
                  {scenario.question}
                </div>
                <div className="max-w-[92%] space-y-2 rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs leading-relaxed text-slate-200">
                  <p>{scenario.answer}</p>
                  {scenario.code && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-slate-800 bg-[#0a0e16]">
                      <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-1.5">
                        <span className="font-mono text-[10px] text-slate-500">{scenario.code.label}</span>
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          <span>{copied ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-slate-300">
                        <code>{scenario.code.lines.join('\n')}</code>
                      </pre>
                    </div>
                  )}
                  <CitationTag
                    source={scenario.citation.source}
                    coordinate={scenario.citation.coordinate}
                    excerpt={scenario.citation.excerpt}
                    score={scenario.citation.score}
                    className="inline-flex items-center gap-1.5 rounded border border-sky-900/70 bg-sky-950/40 px-1.5 py-0.5 text-[10px] text-sky-300"
                  >
                    {scenario.citation.source} <span className="text-slate-500">{scenario.citation.coordinate}</span>
                  </CitationTag>
                </div>
              </div>
              <div className="space-y-3 bg-[#0d1420] p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Context</p>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <p className="text-[11px] font-semibold text-slate-200">{scenario.contextTitle}</p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{scenario.contextExcerpt}</p>
                </div>
              </div>
            </div>
          </div>

          <Stagger
            step={120}
            className="mt-5 flex flex-wrap justify-center gap-2.5 text-[11px] text-slate-400"
          >
            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5">
              Every claim traces to a citation
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5">
              Streams as it generates
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5">
              Source panel stays in view
            </span>
          </Stagger>
        </div>
      </div>
    </section>
  );
}
