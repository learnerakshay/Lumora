import React from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import { ProcessingStage, SourceStatus, SourceType } from '../../lib/source-store';
import { getYouTubeStageLabel } from './youtube-source-ux';

interface SourceStatusBadgeProps {
  status: SourceStatus;
  stage?: ProcessingStage;
  metadata?: Record<string, any> | null;
  sourceType?: SourceType;
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
  sourceType,
  className = '',
}: SourceStatusBadgeProps) {
  const stage = (sourceStage || metadata?.stage || status) as ProcessingStage;
  const isFailed = status === 'FAILED' || stage === 'FAILED';
  const isCompleted = status === 'COMPLETED' && stage === 'COMPLETED';
  const isQueued = status === 'PENDING' || stage === 'CREATED' || stage === 'QUEUED';
  const isCompute = stage === 'PROCESSING' || stage === 'EMBEDDING';
  const label = isFailed
    ? 'Failed'
    : isCompleted
      ? 'Ready'
      : sourceType === 'YOUTUBE'
        ? getYouTubeStageLabel(stage)
        : STAGE_LABELS[stage] || 'Processing';

  const styles = isFailed
    ? 'border-rose-800/60 bg-rose-950/70 text-rose-300'
    : isCompleted
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      : isQueued
        ? 'border-slate-700 bg-slate-900 text-slate-300'
        : isCompute
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 font-mono animate-pulse'
          : 'border-sky-800/60 bg-sky-950/70 text-sky-300';

  const Icon = isFailed ? AlertCircle : isCompleted ? CheckCircle2 : isQueued ? Clock3 : Loader2;

  return (
    <span
      role="status"
      aria-label={`Source status: ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${styles} ${className}`}
    >
      <Icon
        aria-hidden="true"
        className={`h-3 w-3 shrink-0 ${!isFailed && !isCompleted && !isQueued ? 'animate-spin' : ''}`}
      />
      <span>{label}</span>
    </span>
  );
}
