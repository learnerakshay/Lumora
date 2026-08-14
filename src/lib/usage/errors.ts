import { AppError } from '../errors';
import type { UsageLimitDetails } from './types';

const ACTION_LABELS = {
  CHAT: 'chat',
  INGESTION: 'source ingestion',
  AI_ACTION: 'AI Action',
} as const;

export function usageLimitError(details: UsageLimitDetails): AppError {
  const recovery = details.nextAvailableAt
    ? ` Capacity begins returning at ${new Date(details.nextAvailableAt).toISOString()}.`
    : ' In-flight requests are currently reserving the remaining capacity.';
  return new AppError(
    `Your ${details.plan} ${ACTION_LABELS[details.actionType]} limit is currently reached.${recovery}`,
    429,
    'USAGE_LIMIT_REACHED',
    true,
    details as unknown as Record<string, unknown>,
  );
}
