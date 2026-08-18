import React, { useEffect, useRef, useState } from 'react';
import { Reveal } from './motion/Reveal';
import { Stagger } from './motion/Stagger';
import { useReducedMotion } from './motion/useReducedMotion';

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

  return (
    <section className="landing-section relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-950/16 blur-[130px]" />

      <div className="relative z-10 mx-auto max-w-5xl space-y-10">
        <Reveal as="div" className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-sky-400">
            <span>See it working</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">This is what a grounded answer looks like.</h2>
        </Reveal>

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
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-xl border border-white/[0.08] bg-white/[0.03] sm:grid-cols-[1.6fr_1fr]">
              <div className="space-y-4 bg-[#0b0f17] p-6" aria-hidden="true">
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm border border-sky-800/40 bg-sky-500/15 px-4 py-2.5 text-xs text-sky-100">
                  What is the strongest finding across my sources?
                </div>
                <div className="max-w-[85%] space-y-2 rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs leading-relaxed text-slate-200">
                  <p>
                    The evidence converges on one key insight: retrieval alone isn&apos;t enough — sufficiency has to
                    be judged before an answer can be called grounded.
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded border border-sky-900/70 bg-sky-950/40 px-1.5 py-0.5 text-[10px] text-sky-300">
                    Research.pdf <span className="text-slate-500">Page 3</span>
                  </span>
                </div>
              </div>
              <div className="space-y-3 bg-[#0d1420] p-5" aria-hidden="true">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Context</p>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <p className="text-[11px] font-semibold text-slate-200">Research.pdf</p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                    &quot;...sufficiency of retrieved evidence must be assessed before an answer is treated as
                    grounded, not assumed from the presence of chunks alone.&quot;
                  </p>
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
