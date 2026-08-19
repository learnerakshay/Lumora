import React from 'react';
import { Hash } from 'lucide-react';

type LegalSectionVariant = 'default' | 'ai' | 'security';

interface LegalSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  variant?: LegalSectionVariant;
}

const VARIANT_BODY_CLASSES: Record<LegalSectionVariant, string> = {
  default: 'space-y-3 text-sm leading-7 text-slate-400',
  ai: 'space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-7 text-amber-200/90',
  security: 'space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm leading-7 text-cyan-200/90',
};

// One numbered/anchored section within a LegalPageLayout page. `id` must
// match the corresponding entry in the page's `toc` array. `title` is always
// "N. Label" — the leading number is pulled out into its own glowing tag
// rather than duplicated as a separate prop.
export function LegalSection({ id, title, children, variant = 'default' }: LegalSectionProps) {
  const match = title.match(/^(\d+)\.\s*(.+)$/);
  const number = match?.[1];
  const heading = match?.[2] ?? title;

  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="group mb-1 flex items-center gap-3 border-b border-slate-800/60 pb-2">
        {number && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 font-mono text-[11px] font-semibold text-cyan-300">
            {number}
          </span>
        )}
        <h2 className="text-base font-semibold text-white sm:text-lg">{heading}</h2>
        <a
          href={`#${id}`}
          aria-label={`Direct link to section: ${heading}`}
          className="ml-auto shrink-0 rounded-md p-1 text-slate-600 opacity-0 transition-opacity hover:text-cyan-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 group-hover:opacity-100"
        >
          <Hash className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className={VARIANT_BODY_CLASSES[variant]}>{children}</div>
    </section>
  );
}
