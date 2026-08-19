import React from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Loader2 } from 'lucide-react';
import { useUsage } from './UsageProvider';
import { selectHeaderUsage } from '../../lib/usage/presentation';
import { formatRecoveryLabel } from './UsageLimitNotice';

const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function QuotaRing({ used, limit }: { used: number; limit: number }) {
  const fraction = limit > 0 ? Math.min(1, used / limit) : 0;
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" className="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
      <circle
        cx="10"
        cy="10"
        r={RING_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}

export function UsageIndicator({
  compact = false,
  iconOnly = false,
  accent = 'cyan',
  onOpen,
}: {
  compact?: boolean;
  iconOnly?: boolean;
  accent?: 'cyan' | 'violet';
  onOpen?: () => void;
}) {
  const { summary, loading } = useUsage();
  const displayedUsage = summary ? selectHeaderUsage(summary) : null;
  const plan = summary
    ? `${summary.plan.slice(0, 1)}${summary.plan.slice(1).toLowerCase()}`
    : 'Usage';
  const label = displayedUsage ? `${plan} plan, ${displayedUsage.label} ${displayedUsage.used} of ${displayedUsage.limit}` : 'View usage';

  const icon = loading && !summary ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
  ) : (
    <Gauge className="h-3.5 w-3.5" />
  );

  if (iconOnly) {
    const iconOnlyClassName = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";
    if (onOpen) return (
      <button type="button" onClick={onOpen} title={label} aria-label={label} className={iconOnlyClassName}>
        {icon}
      </button>
    );
    return <Link to="/usage" title={label} aria-label={label} className={iconOnlyClassName}>{icon}</Link>;
  }

  const dividerClassName = accent === 'violet' ? 'text-violet-300/50' : 'text-cyan-300/50';
  const usedLimitClassName = accent === 'violet' ? 'font-mono text-violet-100' : 'font-mono text-cyan-100';
  const nextAvailableAt = displayedUsage ? summary!.perAction[displayedUsage.actionType].nextAvailableAt : null;
  const tooltipText = displayedUsage
    ? `${displayedUsage.used} of ${displayedUsage.limit} ${displayedUsage.label} used in this ${summary!.windowHours}-hour rolling window${nextAvailableAt ? ` · ${formatRecoveryLabel(nextAvailableAt)}` : ''}`
    : null;
  const content = <>
      {displayedUsage ? <QuotaRing used={displayedUsage.used} limit={displayedUsage.limit} /> : icon}
      <span>{plan}</span>
      {displayedUsage && (
        <>
          <span className={dividerClassName}>·</span>
          <span>{compact ? displayedUsage.compactLabel : displayedUsage.label}</span>
          <span className={usedLimitClassName}>{displayedUsage.used}/{displayedUsage.limit}</span>
        </>
      )}
    </>;
  const className = accent === 'violet'
    ? "group/quota relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-300 transition hover:border-violet-400/45 hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
    : "group/quota relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-2.5 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";
  const tooltip = tooltipText && (
    <span
      role="tooltip"
      className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-slate-800 bg-[#0d1420]/98 p-2.5 text-left text-[11px] font-normal normal-case leading-relaxed text-slate-300 opacity-0 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-200 group-hover/quota:opacity-100 group-focus-visible/quota:opacity-100"
    >
      {tooltipText}
    </span>
  );
  if (onOpen) return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={className}
    >
      {content}
      {tooltip}
    </button>
  );
  return <Link to="/usage" aria-label={label} className={className}>{content}{tooltip}</Link>;
}
