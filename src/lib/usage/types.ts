import type { MeteredUsageAction, PlanName } from './config';

export interface UsageActionSummary {
  used: number;
  limit: number;
  remaining: number;
  nextAvailableAt: string | null;
}

export interface UsageSummary {
  plan: PlanName;
  windowHours: 24;
  perAction: Record<MeteredUsageAction, UsageActionSummary>;
  planLimits: Record<PlanName, Record<MeteredUsageAction, number>>;
}

export interface UsageLimitDetails extends UsageActionSummary {
  actionType: MeteredUsageAction;
  plan: PlanName;
}

export interface UsageLimitApiError {
  code: 'USAGE_LIMIT_REACHED';
  message: string;
  details: UsageLimitDetails;
}
