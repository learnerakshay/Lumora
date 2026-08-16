import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Edit2,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Layers,
  Cpu,
  Quote,
} from 'lucide-react';
import { SourceRecord } from '../../lib/source-store';
import type { StoredCitation } from '../../lib/chat/conversation-store';
import { SourceTypeIcon } from './SourceTypeIcon';
import { SourceStatusBadge } from './SourceStatusBadge';
import { getYouTubeFailureMessage, getYouTubeStageLabel } from './youtube-source-ux';
import { UsageLimitNotice } from '../usage/UsageLimitNotice';
import { usageLimitFromPayload } from '../../lib/usage/client';
import type { UsageLimitDetails } from '../../lib/usage/types';
import { canReprocessSource } from './workspace-interactions';

interface SourceDetailsModalProps {
  source: SourceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: SourceRecord) => void;
  onRequestDelete: (source: SourceRecord) => void;
  focusedCitation?: StoredCitation | null;
}

export function SourceDetailsModal({
  source,
  isOpen,
  onClose,
  onUpdate,
  onRequestDelete,
  focusedCitation = null,
}: SourceDetailsModalProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageLimit, setUsageLimit] = useState<UsageLimitDetails | null>(null);
  const reprocessingRef = useRef(false);

  useEffect(() => {
    if (!source) return;
    setNewTitle(source.title);
    setIsEditingTitle(false);
    setError(null);
    setUsageLimit(null);
    reprocessingRef.current = false;
  }, [source]);

  if (!isOpen || !source) return null;

  const isCompleted = source.status === 'COMPLETED';
  const isFailed = source.status === 'FAILED';
  const isProcessing = source.status === 'PROCESSING' || source.status === 'PENDING';

  // Ensure pipeline stage is always strictly aligned with status
  const stage = source.stage;

  const stageProgress = isCompleted
    ? 100
    : isFailed
    ? 0
    : source.metadata?.stageProgress ?? 30;

  // Passage count from actual processing metadata
  const chunkCount =
    source.metadata?.chunkCount !== undefined && source.metadata?.chunkCount !== null
      ? `${source.metadata.chunkCount} ${source.metadata.chunkCount === 1 ? 'chunk' : 'chunks'}`
      : isCompleted
      ? '0 chunks'
      : '—';

  const textLengthVal = source.metadata?.textLength || source.metadata?.characters;
  const textLengthDisplay =
    textLengthVal !== undefined && textLengthVal !== null
      ? `${textLengthVal.toLocaleString()} chars`
      : '—';

  const errorMessage = source.metadata?.errorMessage || null;
  const youtubeFailure = source.type === 'YOUTUBE' && isFailed
    ? getYouTubeFailureMessage(source.metadata)
    : null;
  const canReprocess = canReprocessSource(source);
  const targetUrl = source.url || source.metadata?.url || null;
  const displaySize = source.fileSize || source.metadata?.fileSize || 'Auto Ingest';

  const handleRename = async () => {
    if (!newTitle.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/workspaces/${source.workspaceId}/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (!res.ok) throw new Error('Failed to update source title.');

      const payload = await res.json();
      if (payload.success && payload.data) {
        onUpdate(payload.data);
        setIsEditingTitle(false);
      }
    } catch (err: any) {
      setError(err.message || 'Error updating title.');
    } finally {
      setSaving(false);
    }
  };

  const handleReprocess = async () => {
    if (reprocessingRef.current || isProcessing || !canReprocess) return;
    reprocessingRef.current = true;
    try {
      setReprocessing(true);
      setError(null);
      setUsageLimit(null);
      const res = await fetch(
        `/api/workspaces/${source.workspaceId}/sources/${source.id}/reprocess`,
        {
          method: 'POST',
        }
      );

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const limitError = usageLimitFromPayload(payload);
        if (limitError) {
          setUsageLimit(limitError.details);
          return;
        }
        throw new Error(payload?.error?.message || 'Lumora could not start processing this source again.');
      }

      onUpdate({
        ...source,
        status: 'PENDING',
        stage: 'QUEUED',
        metadata: {
          ...(source.metadata || {}),
          stage: 'QUEUED',
          stageProgress: 5,
          errorMessage: null,
          errorCode: null,
          errorCategory: null,
          retryable: null,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Unable to process this source again.');
    } finally {
      reprocessingRef.current = false;
      setReprocessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="source-details-title" className="flex max-h-[96dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-[#121824] shadow-2xl sm:max-h-[92vh] sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
              <SourceTypeIcon type={source.type} className="w-5 h-5" />
            </div>
            <div>
              <h2 id="source-details-title" className="text-sm font-bold text-white">Source details</h2>
              <span className="text-[10px] text-slate-400">{source.type === 'WEBSITE' ? 'Website' : source.type === 'TEXT' ? 'Plain text' : source.type}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close source details dialog"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 overflow-y-auto p-4 sm:p-6">
          {usageLimit && (
            <div className="overflow-hidden rounded-xl border border-amber-400/20">
              <UsageLimitNotice details={usageLimit} onDismiss={() => setUsageLimit(null)} />
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-center space-x-2 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {focusedCitation?.sourceId === source.id && (
            <section aria-labelledby="cited-passage-title" className="rounded-xl border border-cyan-800/60 bg-cyan-950/20 p-4">
              <div className="flex items-center gap-2 text-cyan-300">
                <Quote className="h-4 w-4" />
                <h3 id="cited-passage-title" className="text-[11px] font-semibold uppercase tracking-wider">Cited passage</h3>
              </div>
              <p className="mt-2 text-[10px] font-medium text-cyan-200/70">
                {focusedCitation.page ? `Page ${focusedCitation.page}` : focusedCitation.textOrigin || 'Source passage'}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-200">{focusedCitation.snippet}</p>
            </section>
          )}

          {/* Title Area with Edit toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Source Title
              </label>
              {!isEditingTitle && (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center space-x-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Rename</span>
                </button>
              )}
            </div>

            {isEditingTitle ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={handleRename}
                  disabled={saving}
                  className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center space-x-1"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 stroke-[3]" />}
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-semibold text-white break-words">
                {source.title}
              </div>
            )}
          </div>

          {/* Pipeline Processing Status Banner */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-white uppercase text-[11px] tracking-wider font-mono">
                  Processing: {source.type === 'YOUTUBE'
                    ? getYouTubeStageLabel(stage)
                    : stage.replaceAll('_', ' ')}
                </span>
              </div>
              <SourceStatusBadge status={source.status} stage={source.stage} metadata={source.metadata} sourceType={source.type} />
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  source.status === 'FAILED'
                    ? 'bg-rose-500'
                    : source.status === 'COMPLETED'
                    ? 'bg-emerald-400'
                    : 'bg-sky-500 animate-pulse'
                }`}
                style={{ width: `${stageProgress}%` }}
              />
            </div>

            {youtubeFailure ? (
              <div className="rounded-lg border border-rose-900/60 bg-rose-950/40 p-2.5 text-[11px] leading-relaxed text-rose-300">
                <p className="font-medium">{youtubeFailure.title}</p>
                {youtubeFailure.detail && (
                  <p className="mt-0.5 text-rose-300/70">{youtubeFailure.detail}</p>
                )}
              </div>
            ) : errorMessage ? (
              <p className="text-[11px] text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/60 leading-relaxed font-mono">
                Error: {errorMessage}
              </p>
            ) : null}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase flex items-center space-x-1">
                <Layers className="w-3 h-3 text-sky-400" />
                <span>Indexed passages</span>
              </span>
              <div className="text-xs font-bold text-slate-200 font-mono">
                {chunkCount}
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Text Length</span>
              <div className="text-xs font-mono font-medium text-slate-300">
                {textLengthDisplay}
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Size / Format</span>
              <div className="text-xs font-mono font-medium text-slate-300">
                {displaySize}
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Ingested Date</span>
              <div className="text-xs font-mono font-medium text-slate-300">
                {new Date(source.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* URL or Location info */}
          {targetUrl && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                Target URL
              </label>
              <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-mono text-sky-400 truncate">
                <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {targetUrl}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 bg-slate-900/60 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {canReprocess && <button
              type="button"
              onClick={handleReprocess}
              disabled={reprocessing || isProcessing}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-medium transition-colors flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                isProcessing
                  ? 'Source processing is in progress…'
                  : 'Process this source again'
              }
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reprocessing || isProcessing ? 'animate-spin' : ''}`} />
              <span>{reprocessing
                ? isFailed ? 'Retrying…' : 'Reprocessing…'
                : isProcessing
                  ? 'Processing…'
                  : isFailed ? 'Retry' : 'Reprocess'}</span>
            </button>}

            <button
              type="button"
              onClick={() => onRequestDelete(source)}
              className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs font-medium transition-colors flex items-center space-x-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete Source</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
