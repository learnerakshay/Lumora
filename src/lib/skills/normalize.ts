import type { Topic } from '../resources/domain';
import { classifySkillTopic } from './taxonomy';
import { maxEvidenceLevel } from './evidence';
import type { EvidenceLevel, EvidenceReference, ExtractedProfile, NormalizedSkill } from './types';

interface DraftSkill {
  label: string;
  topic: Topic | null;
  evidenceLevel: EvidenceLevel;
  evidenceRefs: EvidenceReference[];
}

function skillKey(label: string, topic: Topic | null): string {
  return topic ? `topic:${topic}` : `label:${label.trim().toLowerCase()}`;
}

// Deterministic evidence-level derivation: a skill's level is the strongest
// signal found across every place it appears, never an average or a guess.
export function normalizeExtractedProfile(profile: ExtractedProfile): NormalizedSkill[] {
  const drafts = new Map<string, DraftSkill>();

  function upsert(label: string, topic: Topic | null, level: EvidenceLevel, ref: EvidenceReference): void {
    const key = skillKey(label, topic);
    const existing = drafts.get(key);
    if (existing) {
      existing.evidenceLevel = maxEvidenceLevel(existing.evidenceLevel, level);
      existing.evidenceRefs.push(ref);
      return;
    }
    drafts.set(key, { label, topic, evidenceLevel: level, evidenceRefs: [ref] });
  }

  for (const skill of profile.skills) {
    const topic = classifySkillTopic(skill.label);
    const baseLevel: EvidenceLevel =
      skill.context === 'PROJECT' || skill.context === 'EXPERIENCE' ? 'APPLIED' : 'MENTIONED';
    upsert(skill.label, topic, baseLevel, { kind: 'SKILL', id: skill.id, label: skill.label });
  }

  for (const project of profile.projects) {
    const level: EvidenceLevel = project.hasLink || project.outcomes.length > 0 ? 'SHIPPED' : 'APPLIED';
    for (const tech of project.technologies) {
      const topic = classifySkillTopic(tech);
      upsert(tech, topic, level, { kind: 'PROJECT', id: project.id, label: project.name });
    }
  }

  for (const experience of profile.experience) {
    const level: EvidenceLevel =
      experience.durationMonths !== null && experience.durationMonths >= 3 ? 'SHIPPED' : 'APPLIED';
    for (const tech of experience.technologies) {
      const topic = classifySkillTopic(tech);
      upsert(tech, topic, level, {
        kind: 'EXPERIENCE',
        id: experience.id,
        label: `${experience.title} @ ${experience.organization}`,
      });
    }
  }

  return [...drafts.values()].map((draft) => ({
    skillId: skillKey(draft.label, draft.topic),
    label: draft.label,
    topic: draft.topic,
    evidenceLevel: draft.evidenceLevel,
    evidenceRefs: draft.evidenceRefs,
  }));
}
