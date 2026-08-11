import React from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import { ProcessingStage, SourceStatus } from '../../lib/source-store';

interface SourceStatusBadgeProps {
  status: SourceStatus;
  stage?: ProcessingStage;
  metadata?: Record<string, any> | null;
  className?: string;
}

const STAGE_LABELS: Partial<Record<ProcessingStage, string>> = {
  CREATED: 'Created',
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  FETCHING: 'Fetching',
  PARSING: 'Parsing',
  CHUNKING: 'Chunking',
  READY_FOR_INDEXING: 'Ready to index',
  EMBEDDING: 'Embedding',
  INDEXING: 'Indexing',
  COMPLETED: 'Ready',
  FAILED: 'Failed',
};

export function SourceStatusBadge({
  status,
  stage: sourceStage,
  metadata,
  className = '',
}: SourceStatusBadgeProps) {
  const stage = (sourceStage || metadata?.stage || status) as ProcessingStage;
  const isFailed = status === 'FAILED' || stage === 'FAILED';
  const isCompleted = status === 'COMPLETED' && stage === 'COMPLETED';
  const isQueued = status === 'PENDING' || stage === 'CREATED' || stage === 'QUEUED';
  const label = isFailed
    ? 'Failed'
    : isCompleted
      ? 'Ready'
      : STAGE_LABELS[stage] || 'Processing';

  const styles = isFailed
    ? 'border-rose-800/60 bg-rose-950/70 text-rose-300'
    : isCompleted
      ? 'border-emerald-800/60 bg-emerald-950/70 text-emerald-300'
      : isQueued
        ? 'border-slate-700 bg-slate-900 text-slate-300'
        : 'border-sky-800/60 bg-sky-950/70 text-sky-300';

  const Icon = isFailed ? AlertCircle : isCompleted ? CheckCircle2 : isQueued ? Clock3 : Loader2;

  return (
    <span
      role="status"
      aria-label={`Source status: ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold leading-none ${styles} ${className}`}
    >
      <Icon
        aria-hidden="true"
        className={`h-3 w-3 shrink-0 ${!isFailed && !isCompleted && !isQueued ? 'animate-spin' : ''}`}
      />
      <span>{label}</span>
    </span>
  );
}
