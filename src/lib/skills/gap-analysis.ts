import { classifySkillTopic } from './taxonomy';
import { getRoleDefinition } from './roles';
import { EVIDENCE_LEVEL_RANK } from './evidence';
import {
  GAP_ANALYSIS_ENGINE_VERSION,
  type EvidenceLevel,
  type ExtractedProfile,
  type Gap,
  type GapReport,
  type GapSeverity,
  type NormalizedSkill,
  type RoleDefinition,
  type RoleStrength,
  type TargetRole,
} from './types';

function severityForShortfall(weight: number, requiredLevel: EvidenceLevel, observedLevel: EvidenceLevel | 'NONE'): GapSeverity {
  const observedRank = observedLevel === 'NONE' ? 0 : EVIDENCE_LEVEL_RANK[observedLevel];
  const shortfall = EVIDENCE_LEVEL_RANK[requiredLevel] - observedRank;
  const score = weight * shortfall;
  if (score >= 6) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

function technicalSkillGaps(role: TargetRole, roleDef: RoleDefinition, skills: readonly NormalizedSkill[]): Gap[] {
  return role.unmetRequirements.map((unmet) => {
    const requirement = roleDef.requirements.find((candidate) => candidate.topic === unmet.topic);
    const weight = requirement?.weight ?? 1;
    const evidenceRefs = skills.find((skill) => skill.topic === unmet.topic)?.evidenceRefs ?? [];
    const observedText = unmet.observedLevel === 'NONE' ? 'no evidence' : `${unmet.observedLevel.toLowerCase()} evidence`;
    return {
      id: `${role.roleId}:technical:${unmet.topic}`,
      roleId: role.roleId,
      category: 'technical-gap',
      ruleId: 'TECHNICAL_SKILL',
      subject: unmet.label,
      topic: unmet.topic,
      requiredLevel: unmet.requiredLevel,
      observedLevel: unmet.observedLevel,
      severity: severityForShortfall(weight, unmet.requiredLevel, unmet.observedLevel),
      evidenceRefs,
      rationale: `${role.title} expects ${unmet.requiredLevel.toLowerCase()}-level evidence of ${unmet.label}, but the profile shows ${observedText}.`,
      useCase: 'technical-gap',
    };
  });
}

function projectEvidenceGaps(
  role: TargetRole,
  roleDef: RoleDefinition,
  skills: readonly NormalizedSkill[],
  profile: ExtractedProfile,
): Gap[] {
  const gaps: Gap[] = [];

  for (const archetype of roleDef.projectArchetypes) {
    const covered = profile.projects.some((project) => {
      const projectTopics = new Set(
        project.technologies.map((technology) => classifySkillTopic(technology)).filter((topic) => topic !== null),
      );
      return archetype.signatureTopics.every((topic) => projectTopics.has(topic));
    });
    if (covered) continue;
    gaps.push({
      id: `${role.roleId}:project:${archetype.id}`,
      roleId: role.roleId,
      category: 'project-proof',
      ruleId: 'PROJECT_EVIDENCE',
      subject: archetype.label,
      topic: archetype.signatureTopics[0] ?? null,
      requiredLevel: null,
      observedLevel: null,
      severity: 'MEDIUM',
      evidenceRefs: [],
      rationale: `${role.title} expects ${archetype.label.toLowerCase()}, and no project in the profile demonstrates it.`,
      useCase: 'project-proof',
    });
  }

  const relevantTopics = new Set(roleDef.requirements.map((requirement) => requirement.topic));
  for (const skill of skills) {
    if (skill.evidenceLevel !== 'MENTIONED') continue;
    if (!skill.topic || !relevantTopics.has(skill.topic)) continue;
    const hasAppliedEvidence = skill.evidenceRefs.some((ref) => ref.kind === 'PROJECT' || ref.kind === 'EXPERIENCE');
    if (hasAppliedEvidence) continue;
    gaps.push({
      id: `${role.roleId}:project:claimed:${skill.skillId}`,
      roleId: role.roleId,
      category: 'project-proof',
      ruleId: 'PROJECT_EVIDENCE',
      subject: skill.label,
      topic: skill.topic,
      requiredLevel: 'APPLIED',
      observedLevel: 'MENTIONED',
      severity: 'MEDIUM',
      evidenceRefs: skill.evidenceRefs,
      rationale: `${skill.label} is listed as a skill, but no project or role in the profile shows it being used.`,
      useCase: 'project-proof',
    });
  }

  return gaps;
}

function interviewPrepGaps(
  role: TargetRole,
  roleDef: RoleDefinition,
  skills: readonly NormalizedSkill[],
  profile: ExtractedProfile,
): Gap[] {
  const gaps: Gap[] = [];
  for (const competency of roleDef.interviewCompetencies) {
    const hasSkillSignal = skills.some((skill) => skill.topic === competency.topic);
    const hasCertificationSignal = profile.certifications.some(
      (certification) => classifySkillTopic(certification.name) === competency.topic,
    );
    if (hasSkillSignal || hasCertificationSignal) continue;
    gaps.push({
      id: `${role.roleId}:interview:${competency.topic}`,
      roleId: role.roleId,
      category: 'interview-prep',
      ruleId: 'INTERVIEW_PREP',
      subject: competency.label,
      topic: competency.topic,
      requiredLevel: null,
      observedLevel: null,
      severity: 'MEDIUM',
      evidenceRefs: [],
      rationale: `${role.title} interviews commonly probe ${competency.label.toLowerCase()}, and the profile shows no supporting signal.`,
      useCase: 'interview-prep',
    });
  }
  return gaps;
}

// Every gap is produced by one of three explicit rule families over the
// normalized profile and the selected roles' own requirement definitions —
// never by asking a model what is missing.
export function analyzeSkillGaps(
  profile: ExtractedProfile,
  skills: readonly NormalizedSkill[],
  roles: readonly TargetRole[],
): GapReport {
  const gaps: Gap[] = [];
  const strengths: RoleStrength[] = [];

  for (const role of roles) {
    const roleDef = getRoleDefinition(role.roleId);
    if (!roleDef) continue;
    gaps.push(...technicalSkillGaps(role, roleDef, skills));
    gaps.push(...projectEvidenceGaps(role, roleDef, skills, profile));
    gaps.push(...interviewPrepGaps(role, roleDef, skills, profile));
    for (const matched of role.matchedRequirements) {
      strengths.push({
        roleId: role.roleId,
        topic: matched.topic,
        label: matched.label,
        observedLevel: matched.observedLevel,
        evidenceRefs: matched.evidenceRefs,
      });
    }
  }

  return { engineVersion: GAP_ANALYSIS_ENGINE_VERSION, roles: [...roles], gaps, strengths };
}
