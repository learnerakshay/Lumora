import React from 'react';
import { Link } from 'react-router-dom';
import { Gauge, X } from 'lucide-react';
import type { UsageLimitDetails } from '../../lib/usage/types';
import type { MeteredUsageAction } from '../../lib/usage/config';

// Typed as Record<MeteredUsageAction, string> so a missing entry is a
// COMPILE ERROR, not a silent "undefined" in the rendered notice — this is
// exactly the bug that previously shipped (SKILL_INTELLIGENCE and
// LEARNING_PATH were missing, producing "FREE undefined capacity
// reached"). Guarded by an exhaustiveness test in usage-presentation.test.ts.
export const ACTION_LABELS: Record<MeteredUsageAction, string> = {
  CHAT: 'chat',
  INGESTION: 'source ingestion',
  AI_ACTION: 'AI Action',
  SKILL_INTELLIGENCE: 'Skill Intelligence',
  LEARNING_PATH: 'Learning Path',
};

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
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <Link to="/usage" className="inline-block font-semibold text-cyan-300 hover:text-cyan-200">
            View usage and plans
          </Link>
          {/* MAX has no higher tier to sell — recovery time is the only
              honest thing left to say, so no CTA renders for it. */}
          {details.plan !== 'MAX' && (
            <Link to="/pricing" className="inline-block font-semibold text-amber-200 underline decoration-amber-400/40 underline-offset-2 hover:text-amber-100">
              Upgrade for more capacity
            </Link>
          )}
        </p>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss usage notice" className="rounded-lg p-1 text-amber-200/60 hover:bg-amber-300/10 hover:text-amber-100">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
