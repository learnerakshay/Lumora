import { RESOURCE_TOPICS, type Topic } from '../resources/domain';
import { normalizeTopic } from '../resources/normalization';

export const SKILL_TAXONOMY_TOPICS: readonly Topic[] = RESOURCE_TOPICS;

// Reuses the Resource Intelligence Topic vocabulary so gaps map onto Phase 2 without translation.
export function classifySkillTopic(label: string): Topic | null {
  return normalizeTopic(label);
}
