import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface SupportCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action: React.ReactNode;
}

// Compact contact/support surface card — used on the Contact page for
// "General Support", "Bug Report", and self-service links.
export function SupportCard({ icon: Icon, title, description, action }: SupportCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/60 bg-[#101826]/80 p-6 transition-colors hover:border-slate-700/70">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-sky-400">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
      <div className="mt-auto pt-1">{action}</div>
    </div>
  );
}
