import React from 'react';
import { Link } from 'react-router-dom';
import { Gauge, X } from 'lucide-react';
import type { UsageLimitDetails } from '../../lib/usage/types';

const ACTION_LABELS = {
  CHAT: 'chat',
  INGESTION: 'source ingestion',
  AI_ACTION: 'AI Action',
} as const;

export function formatRecoveryTime(value: string | null, now = Date.now()): string {
  if (!value) return 'Capacity will be available after current in-flight work finishes.';
  const date = new Date(value);
  const remainingMs = date.getTime() - now;
  if (remainingMs <= 0) return 'Capacity is available now.';
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const relative = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return `Capacity begins returning in ${relative} (${date.toLocaleString()}).`;
}

export function formatRecoveryLabel(value: string | null, now = Date.now()): string {
  if (!value) return 'No capacity currently waiting to recover';
  const date = new Date(value);
  const remainingMs = date.getTime() - now;
  if (remainingMs <= 0) return 'Capacity is available now';
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `Next recovery in ${hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}`;
}

export function UsageLimitNotice({
  details,
  onDismiss,
}: {
  details: UsageLimitDetails;
  onDismiss?: () => void;
}) {
  return (
    <div role="status" className="flex items-start gap-3 border-b border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-amber-100">
      <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <div className="min-w-0 flex-1 text-xs leading-relaxed">
        <p className="font-semibold">
          {details.plan} {ACTION_LABELS[details.actionType]} capacity reached ({details.used}/{details.limit}).
        </p>
        <p className="mt-0.5 text-amber-100/70">{formatRecoveryTime(details.nextAvailableAt)}</p>
        <Link to="/usage" className="mt-1 inline-block font-semibold text-cyan-300 hover:text-cyan-200">
          View usage and plans
        </Link>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss usage notice" className="rounded-lg p-1 text-amber-200/60 hover:bg-amber-300/10 hover:text-amber-100">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
