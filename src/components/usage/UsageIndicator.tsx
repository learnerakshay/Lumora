import React from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Loader2 } from 'lucide-react';
import { useUsage } from './UsageProvider';
import { selectHeaderUsage } from '../../lib/usage/presentation';

export function UsageIndicator({ compact = false, onOpen }: { compact?: boolean; onOpen?: () => void }) {
  const { summary, loading } = useUsage();
  const displayedUsage = summary ? selectHeaderUsage(summary) : null;
  const plan = summary
    ? `${summary.plan.slice(0, 1)}${summary.plan.slice(1).toLowerCase()}`
    : 'Usage';

  const content = <>
      {loading && !summary ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Gauge className="h-3.5 w-3.5" />
      )}
      <span>{plan}</span>
      {displayedUsage && (
        <>
          <span className="text-cyan-300/50">·</span>
          <span>{compact ? displayedUsage.compactLabel : displayedUsage.label}</span>
          <span className="font-mono text-cyan-100">{displayedUsage.used}/{displayedUsage.limit}</span>
        </>
      )}
    </>;
  const className = "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-2.5 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";
  const label = displayedUsage ? `${plan} plan, ${displayedUsage.label} ${displayedUsage.used} of ${displayedUsage.limit}` : 'View usage';
  if (onOpen) return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={displayedUsage ? `${plan} plan, ${displayedUsage.label} ${displayedUsage.used} of ${displayedUsage.limit}` : 'View usage'}
      className={className}
    >
      {content}
    </button>
  );
  return <Link to="/usage" aria-label={label} className={className}>{content}</Link>;
}
