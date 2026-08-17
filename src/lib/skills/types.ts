import type { Topic, UseCase } from '../resources/domain';

export type SkillCategory = 'language' | 'framework' | 'tool' | 'platform' | 'concept';
export type SkillEvidenceContext = 'SKILLS_SECTION' | 'EXPERIENCE' | 'PROJECT' | 'EDUCATION';

export interface ExtractedSkill {
  id: string;
  label: string;
  category: SkillCategory;
  context: SkillEvidenceContext;
}

export interface ExtractedProject {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  hasLink: boolean;
  outcomes: string[];
}

export interface ExtractedExperience {
  id: string;
  title: string;
  organization: string;
  durationMonths: number | null;
  responsibilities: string[];
  technologies: string[];
}

export interface ExtractedEducation {
  id: string;
  credential: string;
  field: string;
  institution: string;
}

export interface ExtractedCertification {
  id: string;
  name: string;
  issuer: string;
}

export const EXTRACTION_CONTRACT_VERSION = 'skill-extraction-1';

export interface ExtractedProfile {
  schemaVersion: typeof EXTRACTION_CONTRACT_VERSION;
  headline: string | null;
  yearsOfExperienceStated: number | null;
  skills: ExtractedSkill[];
  projects: ExtractedProject[];
  experience: ExtractedExperience[];
  education: ExtractedEducation[];
  certifications: ExtractedCertification[];
}

export type EvidenceLevel = 'MENTIONED' | 'APPLIED' | 'SHIPPED';

export interface EvidenceReference {
  kind: 'SKILL' | 'PROJECT' | 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION';
  id: string;
  label: string;
}

export interface NormalizedSkill {
  skillId: string;
  label: string;
  topic: Topic | null;
  evidenceLevel: EvidenceLevel;
  evidenceRefs: EvidenceReference[];
}

export const GAP_ANALYSIS_ENGINE_VERSION = 'skill-gap-1';

export type RoleFamily =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'mobile'
  | 'data'
  | 'devops-cloud'
  | 'ai-ml';

export interface RoleRequirement {
  topic: Topic;
  label: string;
  weight: number;
  minEvidenceLevel: EvidenceLevel;
}

export interface RoleProjectArchetype {
  id: string;
  label: string;
  signatureTopics: Topic[];
}

export interface RoleInterviewCompetency {
  topic: Topic;
  label: string;
}

export interface RoleDefinition {
  roleId: string;
  title: string;
  family: RoleFamily;
  requirements: RoleRequirement[];
  projectArchetypes: RoleProjectArchetype[];
  interviewCompetencies: RoleInterviewCompetency[];
}

export interface MatchedRequirement {
  topic: Topic;
  label: string;
  observedLevel: EvidenceLevel;
  evidenceRefs: EvidenceReference[];
}

export interface UnmetRequirement {
  topic: Topic;
  label: string;
  requiredLevel: EvidenceLevel;
  observedLevel: EvidenceLevel | 'NONE';
}

export interface TargetRole {
  roleId: string;
  title: string;
  family: RoleFamily;
  fitScore: number;
  belowConfidenceFloor: boolean;
  matchedRequirements: MatchedRequirement[];
  unmetRequirements: UnmetRequirement[];
}

export type GapCategory = 'technical-gap' | 'project-proof' | 'interview-prep';
export type GapSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Gap {
  id: string;
  roleId: string;
  category: GapCategory;
  ruleId: string;
  subject: string;
  topic: Topic | null;
  requiredLevel: EvidenceLevel | null;
  observedLevel: EvidenceLevel | 'NONE' | null;
  severity: GapSeverity;
  evidenceRefs: EvidenceReference[];
  rationale: string;
  useCase: UseCase;
}

export interface RoleStrength {
  roleId: string;
  topic: Topic;
  label: string;
  observedLevel: EvidenceLevel;
  evidenceRefs: EvidenceReference[];
}

export interface GapReport {
  engineVersion: typeof GAP_ANALYSIS_ENGINE_VERSION;
  roles: TargetRole[];
  gaps: Gap[];
  strengths: RoleStrength[];
}
