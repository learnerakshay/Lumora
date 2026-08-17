import type { EvidenceLevel, Gap } from '../skills/types';
import type { RequiredCompetency } from './types';

const RULE_ID_DEFAULT_TARGET: Record<string, EvidenceLevel> = {
  PROJECT_EVIDENCE: 'SHIPPED',
  INTERVIEW_PREP: 'MENTIONED',
};

// Required competency is read from the gap's own fields wherever the gap
// analysis already stated them. Only archetype-style gaps (no requiredLevel
// on the gap itself) fall back to a fixed per-ruleId target — never a guess.
export function deriveCompetency(gap: Gap): RequiredCompetency {
  const targetLevel = gap.requiredLevel ?? RULE_ID_DEFAULT_TARGET[gap.ruleId] ?? null;
  const observedLevel = gap.observedLevel ?? 'NONE';
  return { label: gap.subject, targetLevel, observedLevel };
}
