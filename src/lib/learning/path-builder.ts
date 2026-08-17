import { logger } from '../logger';
import { getRoleDefinition } from '../skills/roles';
import type { Gap, GapReport, RoleDefinition } from '../skills/types';
import { buildClosurePlan } from './closure-plan';
import { deriveCompetency } from './competency';
import { buildEvidenceTask } from './evidence-task';
import { narratedReadinessSummary, narratedTextForStep, type NarrativeRequestInput, type RawNarrative } from './narrative-contract';
import { narrateLearningPlan, type NarrationResult } from './narrative-provider';
import { prioritizeGaps, stageIdForBand } from './priority';
import { buildReadinessReport } from './readiness';
import { resolveAllStepResources, type ResourceBridgeDependencies } from './resource-bridge';
import {
  LEARNING_ENGINE_VERSION,
  type LearningPath,
  type LearningStage,
  type LearningStep,
  type ReadinessReport,
  type StageId,
} from './types';

// A safety cap only — the UI already limits gap selection to a handful of
// gaps per role. This exists so a pathological request can never blow up
// the narration payload or the resource-resolution fan-out.
export const MAX_PLAN_STEPS = 8;

const STAGE_LABELS: Record<StageId, string> = {
  now: 'Close now',
  next: 'Next',
  later: 'Later',
};

// The only gaps a client may select are ones that already exist, verbatim,
// in the role's own gap report — never trust client-supplied gap content.
export function selectableGaps(gapReport: GapReport, roleId: string, gapIds: readonly string[]): Gap[] {
  const idSet = new Set(gapIds);
  return gapReport.gaps.filter((gap) => gap.roleId === roleId && idSet.has(gap.id));
}

export interface BuildLearningPathInput {
  analysisId: string;
  roleId: string;
  gapReport: GapReport;
  selectedGapIds: readonly string[];
  planId: string;
  userId: string;
  signal: AbortSignal;
}

export interface BuildLearningPathDependencies extends ResourceBridgeDependencies {
  narrate?: (input: NarrativeRequestInput) => Promise<NarrationResult | null>;
}

export interface BuildLearningPathResult {
  path: LearningPath;
  readiness: ReadinessReport;
  narrativeModel: string | null;
  narrativeUsage: { inputTokens: number; outputTokens: number } | null;
}

// Composes the deterministic core (priority, competency, closure plan,
// evidence task, readiness) with the Resource Intelligence bridge and one
// optional narration pass. Every decision — which gaps, their order, their
// band, their required competency, their closure steps, their evidence
// task, and every resource recommendation — is fully determined before
// narration ever runs; narration can only replace fallback prose, never a
// decision.
export async function buildLearningPath(
  input: BuildLearningPathInput,
  dependencies: BuildLearningPathDependencies = {},
): Promise<BuildLearningPathResult> {
  const role = input.gapReport.roles.find((candidate) => candidate.roleId === input.roleId);
  if (!role) throw new Error(`Role "${input.roleId}" is not present in this analysis.`);
  const roleDef = getRoleDefinition(input.roleId);
  if (!roleDef) throw new Error(`Role "${input.roleId}" has no catalog definition.`);

  const selectedGaps = selectableGaps(input.gapReport, input.roleId, input.selectedGapIds);
  const prioritized = prioritizeGaps(selectedGaps, roleDef).slice(0, MAX_PLAN_STEPS);
  if (prioritized.length < selectedGaps.length) {
    logger.warn('Learning path selection truncated to the safety cap', {
      roleId: input.roleId,
      selectedCount: selectedGaps.length,
      cap: MAX_PLAN_STEPS,
    });
  }

  const derived = prioritized.map((entry) => ({
    ...entry,
    competency: deriveCompetency(entry.gap),
  }));

  const resourceResults = await resolveAllStepResources(
    derived.map(({ gap, competency }) => ({ gap, roleDef, competency })),
    { planId: input.planId, userId: input.userId, signal: input.signal },
    dependencies,
  );

  const readiness = buildReadinessReport(role, selectedGaps, input.gapReport);

  const narrativeInput: NarrativeRequestInput = {
    roleTitle: role.title,
    readinessBand: readiness.band,
    readinessPercent: readiness.readinessPercent,
    steps: derived.map(({ gap, band, competency }) => ({
      stepId: gap.id,
      subject: gap.subject,
      category: gap.category,
      band,
      competencyLabel: competency.label,
      targetLevel: competency.targetLevel,
      observedLevel: competency.observedLevel,
    })),
  };

  let narrationResult: NarrationResult | null = null;
  try {
    const narrate = dependencies.narrate ?? narrateLearningPlan;
    narrationResult = await narrate(narrativeInput);
  } catch (error) {
    logger.warn('Learning plan narration failed closed', {
      roleId: input.roleId,
      reason: error instanceof Error ? error.name : 'unknown',
    });
    narrationResult = null;
  }
  const narrative: RawNarrative | null = narrationResult?.narrative ?? null;

  const steps: LearningStep[] = derived.map((entry, index) => {
    const { gap, priority, band, competency } = entry;
    const closurePlan = buildClosurePlan(gap, competency);
    const evidenceTask = buildEvidenceTask(gap, roleDef);
    const narratedText = narratedTextForStep(
      gap.id,
      { whyItMatters: gap.rationale, evidenceBrief: evidenceTask.brief },
      narrative,
    );
    const resourceResult = resourceResults[index];
    return {
      id: gap.id,
      gapId: gap.id,
      priority,
      band,
      category: gap.category,
      subject: gap.subject,
      topic: gap.topic,
      whyItMatters: narratedText.whyItMatters,
      requiredCompetency: competency,
      closurePlan,
      evidenceTask: { ...evidenceTask, brief: narratedText.evidenceBrief },
      resources: resourceResult.resources,
      resourceStatus: resourceResult.resourceStatus,
    };
  });

  const stages: LearningStage[] = (['now', 'next', 'later'] as StageId[])
    .map((id) => ({
      id,
      label: STAGE_LABELS[id],
      steps: steps.filter((step) => stageIdForBand(step.band) === id),
    }))
    .filter((stage) => stage.steps.length > 0);

  const path: LearningPath = {
    engineVersion: LEARNING_ENGINE_VERSION,
    roleId: input.roleId,
    roleTitle: role.title,
    builtFromAnalysisId: input.analysisId,
    stages,
  };

  return {
    path,
    readiness: { ...readiness, summary: narratedReadinessSummary(readiness.summary, narrative) },
    narrativeModel: narrationResult?.model ?? null,
    narrativeUsage: narrationResult?.usage ?? null,
  };
}
