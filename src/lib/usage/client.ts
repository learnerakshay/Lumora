import type { UsageLimitDetails } from './types';

export class UsageLimitReachedError extends Error {
  constructor(public readonly details: UsageLimitDetails, message: string) {
    super(message);
    this.name = 'UsageLimitReachedError';
  }
}

export function usageLimitFromPayload(payload: unknown): UsageLimitReachedError | null {
  if (!payload || typeof payload !== 'object') return null;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return null;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  if (
    candidate.code !== 'USAGE_LIMIT_REACHED' ||
    !candidate.details ||
    typeof candidate.details !== 'object'
  ) return null;
  const details = candidate.details as UsageLimitDetails;
  if (
    !['CHAT', 'INGESTION', 'AI_ACTION', 'SKILL_INTELLIGENCE'].includes(details.actionType) ||
    !['FREE', 'CORE', 'MAX'].includes(details.plan) ||
    typeof details.used !== 'number' ||
    typeof details.limit !== 'number'
  ) return null;
  return new UsageLimitReachedError(
    details,
    typeof candidate.message === 'string' ? candidate.message : 'Usage capacity reached.',
  );
}
