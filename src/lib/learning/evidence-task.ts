import type { Topic } from '../resources/domain';
import { isClaimedSkillGap } from './closure-plan';
import type { Gap, RoleDefinition } from '../skills/types';
import type { EvidenceTask } from './types';

function archetypeId(gap: Gap): string | null {
  if (gap.ruleId !== 'PROJECT_EVIDENCE' || isClaimedSkillGap(gap)) return null;
  const parts = gap.id.split(':');
  return parts[2] ?? null;
}

// Deterministic per-category task templates. The archetype's own
// signatureTopics (from the role's own catalog entry) drive the acceptance
// criteria — nothing here is invented per gap.
export function buildEvidenceTask(gap: Gap, roleDef: RoleDefinition): EvidenceTask {
  if (gap.ruleId === 'INTERVIEW_PREP') {
    return {
      title: `Prepare to discuss ${gap.subject}`,
      brief: `Be ready to explain ${gap.subject} clearly and give one concrete example from your own work.`,
      acceptanceCriteria: [
        `Can explain ${gap.subject} clearly without notes`,
        'Has at least one concrete example ready to discuss',
      ],
      signatureTopics: gap.topic ? [gap.topic] : [],
    };
  }

  if (gap.ruleId === 'PROJECT_EVIDENCE' && !isClaimedSkillGap(gap)) {
    const archetype = roleDef.projectArchetypes.find((candidate) => candidate.id === archetypeId(gap));
    const signatureTopics: Topic[] = archetype?.signatureTopics ?? (gap.topic ? [gap.topic] : []);
    return {
      title: gap.subject,
      brief: `Build and ship ${gap.subject.toLowerCase()} to prove this for ${roleDef.title}.`,
      acceptanceCriteria: [
        `Uses ${signatureTopics.length > 0 ? signatureTopics.join(', ') : 'the required stack'} as a core part of the implementation`,
        'Is deployed or runnable end-to-end',
        'Has a public link or repository',
      ],
      signatureTopics,
    };
  }

  return {
    title: `Prove ${gap.subject} with a real build`,
    brief: `Show ${gap.subject} being used directly in an implementation, not just listed as a skill.`,
    acceptanceCriteria: [
      `Uses ${gap.subject} as a core part of the implementation`,
      'Is deployed or runnable end-to-end',
      'Has a public link or repository',
    ],
    signatureTopics: gap.topic ? [gap.topic] : [],
  };
}
