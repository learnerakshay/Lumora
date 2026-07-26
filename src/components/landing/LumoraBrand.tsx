import React from 'react';

interface LumoraBrandProps {
  compact?: boolean;
  className?: string;
  markOnly?: boolean;
}

export function LumoraBrand({
  compact = false,
  className = '',
  markOnly = false,
}: LumoraBrandProps) {
  return (
    <span className={`lumora-brand group/brand inline-flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden="true"
        className={`${compact ? 'h-8 w-8' : 'h-11 w-11'} lumora-brand-mark`}
      >
        <img
          src="/brand/lumora-orbit-mark.png"
          alt=""
          className="lumora-brand-image"
          decoding="async"
        />
      </span>
      {!markOnly && (
        <span className="flex min-w-0 flex-col text-left">
          <span className={`${compact ? 'text-base' : 'text-lg'} font-bold tracking-tight text-white transition-colors group-hover/brand:text-sky-200`}>
            Lumora
          </span>
          <span className="-mt-0.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
            Knowledge OS
          </span>
        </span>
      )}
    </span>
  );
}
