import React from 'react';
import { SourceStatus } from '../../lib/source-store';

interface SourceStatusBadgeProps {
  status: SourceStatus;
  metadata?: Record<string, any> | null;
  className?: string;
}

export function SourceStatusBadge({ status, metadata, className = '' }: SourceStatusBadgeProps) {
  const stage = metadata?.stage || (status === 'COMPLETED' ? 'INDEXED' : status === 'FAILED' ? 'FAILED' : 'QUEUED');

  if (status === 'FAILED' || stage === 'FAILED') {
    return (
      <span
        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
        <span>Failed</span>
      </span>
    );
  }

  if (status === 'COMPLETED' || stage === 'INDEXED') {
    return (
      <span
        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span>Indexed</span>
      </span>
    );
  }

  // Blinking Red: Queued / Waiting
  if (stage === 'QUEUED' || stage === 'WAITING' || status === 'PENDING') {
    const label = stage === 'WAITING' ? 'Waiting' : 'Queued';
    return (
      <span
        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60 ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
        </span>
        <span>{label}</span>
      </span>
    );
  }

  // Blinking White: Chunking or Embedding
  if (stage === 'CHUNKING' || stage === 'EMBEDDING') {
    const label = stage === 'CHUNKING' ? 'Chunking' : 'Embedding';
    return (
      <span
        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900 text-slate-200 border border-slate-700 ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-100" />
        </span>
        <span>{label}</span>
      </span>
    );
  }

  // Blinking Yellow: Fetching, parsing, cleaning, or indexing
  let yellowLabel = 'Parsing';
  if (stage === 'FETCHING' || stage === 'FETCHING_TRANSCRIPT') yellowLabel = 'Fetching';
  else if (stage === 'CLEANING') yellowLabel = 'Cleaning';
  else if (stage === 'INDEXING') yellowLabel = 'Indexing';

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60 ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
      </span>
      <span>{yellowLabel}</span>
    </span>
  );
}

