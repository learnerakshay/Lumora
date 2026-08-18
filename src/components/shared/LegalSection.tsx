import React from 'react';

interface LegalSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

// One numbered/anchored section within a LegalPageLayout page. `id` must
// match the corresponding entry in the page's `toc` array.
export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-base font-semibold text-white sm:text-lg">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-slate-400">{children}</div>
    </section>
  );
}
