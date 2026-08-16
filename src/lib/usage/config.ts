export const USAGE_WINDOW_MS = 12 * 60 * 60 * 1_000;
export const USAGE_RESERVATION_TIMEOUT_MS = 5 * 60 * 1_000;

export const PLAN_NAMES = ['FREE', 'CORE', 'MAX'] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

export const USAGE_ACTION_TYPES = [
  'INGESTION',
  'CHAT',
  'AI_ACTION',
  'SKILL_INTELLIGENCE',
  'LEARNING_PATH',
] as const;
export type UsageActionName = (typeof USAGE_ACTION_TYPES)[number];
export type MeteredUsageAction = 'INGESTION' | 'CHAT' | 'AI_ACTION';

export const METERED_USAGE_ACTIONS: readonly MeteredUsageAction[] = [
  'CHAT',
  'INGESTION',
  'AI_ACTION',
];

export const PLAN_LIMITS = {
  FREE: { CHAT: 10, INGESTION: 4, AI_ACTION: 8 },
  CORE: { CHAT: 40, INGESTION: 15, AI_ACTION: 25 },
  MAX: { CHAT: 150, INGESTION: 50, AI_ACTION: 80 },
} as const satisfies Record<PlanName, Record<MeteredUsageAction, number>>;

export const PROVIDER_PRICING_USD_PER_MILLION_TOKENS = {
  'gpt-5.6-sol': { input: 5, output: 30 },
  'gpt-5.6-terra': { input: 2.5, output: 15 },
  'gpt-5.6-luna': { input: 1, output: 6 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
} as const;

export function estimateProviderCostUsd(input: {
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): number | null {
  if (!input.model) return null;
  const pricing = PROVIDER_PRICING_USD_PER_MILLION_TOKENS[
    input.model as keyof typeof PROVIDER_PRICING_USD_PER_MILLION_TOKENS
  ];
  if (!pricing) return null;
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  if (inputTokens === 0 && outputTokens === 0) return null;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
