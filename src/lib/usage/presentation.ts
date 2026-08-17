import type { MeteredUsageAction } from './config';
import type { UsageSummary } from './types';

const HEADER_ACTIONS: ReadonlyArray<{
  actionType: MeteredUsageAction;
  label: string;
  compactLabel: string;
}> = [
  { actionType: 'CHAT', label: 'Chat', compactLabel: 'Chat' },
  { actionType: 'INGESTION', label: 'Ingestion', compactLabel: 'Ingest' },
  { actionType: 'AI_ACTION', label: 'AI Actions', compactLabel: 'Action' },
  { actionType: 'SKILL_INTELLIGENCE', label: 'Skill Intelligence', compactLabel: 'Skills' },
];

export function selectHeaderUsage(summary: UsageSummary) {
  const selected = HEADER_ACTIONS.reduce((current, candidate) => {
    const currentUsage = summary.perAction[current.actionType];
    const candidateUsage = summary.perAction[candidate.actionType];
    return candidateUsage.used / candidateUsage.limit > currentUsage.used / currentUsage.limit
      ? candidate
      : current;
  });
  return {
    ...selected,
    used: summary.perAction[selected.actionType].used,
    limit: summary.perAction[selected.actionType].limit,
  };
}
