import type { Topic } from '../resources/domain';
import type { LearningResourceRecommendation } from '../resources/domain';
import type { EvidenceLevel, GapCategory } from '../skills/types';

export const LEARNING_ENGINE_VERSION = 'learning-path-1';

export type PriorityBand = 'CLOSE_NOW' | 'NEXT' | 'LATER';
export type StageId = 'now' | 'next' | 'later';

export interface RequiredCompetency {
  label: string;
  targetLevel: EvidenceLevel | null;
  observedLevel: EvidenceLevel | 'NONE';
}

export interface EvidenceTask {
  title: string;
  brief: string;
  acceptanceCriteria: string[];
  signatureTopics: Topic[];
}

export type ResourceStatus = 'RESOLVED' | 'NONE';

export interface LearningStep {
  id: string;
  gapId: string;
  priority: number;
  band: PriorityBand;
  category: GapCategory;
  subject: string;
  topic: Topic | null;
  whyItMatters: string;
  requiredCompetency: RequiredCompetency;
  closurePlan: string[];
  evidenceTask: EvidenceTask;
  resources: LearningResourceRecommendation[];
  resourceStatus: ResourceStatus;
}

export interface LearningStage {
  id: StageId;
  label: string;
  steps: LearningStep[];
}

export interface LearningPath {
  engineVersion: typeof LEARNING_ENGINE_VERSION;
  roleId: string;
  roleTitle: string;
  builtFromAnalysisId: string;
  stages: LearningStage[];
}

export type ReadinessBand = 'READY' | 'CLOSE' | 'DEVELOPING' | 'EARLY';

export interface ReadinessReport {
  roleId: string;
  roleTitle: string;
  readinessPercent: number;
  band: ReadinessBand;
  blockingGapCount: number;
  totalStepCount: number;
  strengthCount: number;
  summary: string;
}
