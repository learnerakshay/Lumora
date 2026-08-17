import { logger } from '../logger';
import { toLearningResourceRecommendation } from '../resources/domain';
import type { LearningResourceRecommendation, ResolvedLearningResource, ResourceLevel, Topic } from '../resources/domain';
import { resolveResources, type ResolveResourcesInput } from '../resources/resolver';
import type { Gap, RoleDefinition } from '../skills/types';
import type { RequiredCompetency, ResourceStatus } from './types';

export type ResourceResolveFn = (input: ResolveResourcesInput) => Promise<ResolvedLearningResource[]>;

export interface ResourceBridgeDependencies {
  resolve?: ResourceResolveFn;
}

function stepQuery(gap: Gap, roleDef: RoleDefinition): string {
  return `${gap.subject} for ${roleDef.title}`;
}

// Prefer the gap's own topic; project archetype gaps carry no topic of their
// own, so fall back to the role catalog's signature topics for that
// archetype. If neither exists there is nothing to search for.
function stepTopics(gap: Gap, roleDef: RoleDefinition): Topic[] {
  if (gap.topic) return [gap.topic];
  if (gap.ruleId === 'PROJECT_EVIDENCE') {
    const archetype = roleDef.projectArchetypes.find((candidate) => candidate.label === gap.subject);
    if (archetype && archetype.signatureTopics.length > 0) return archetype.signatureTopics;
  }
  return [];
}

function stepLevel(competency: RequiredCompetency): ResourceLevel | undefined {
  if (competency.observedLevel === 'NONE' || competency.observedLevel === 'MENTIONED') return 'beginner';
  if (competency.observedLevel === 'APPLIED' || competency.observedLevel === 'SHIPPED') return 'advanced';
  return undefined;
}

export interface ResolveStepResourcesInput {
  gap: Gap;
  roleDef: RoleDefinition;
  competency: RequiredCompetency;
  planId: string;
  userId: string;
  signal: AbortSignal;
}

export interface ResolveStepResourcesResult {
  resources: LearningResourceRecommendation[];
  resourceStatus: ResourceStatus;
}

// This never builds its own ranking or discovery — it only shapes a Gap into
// the existing resolveResources() input contract and reuses its output.
export async function resolveStepResources(
  input: ResolveStepResourcesInput,
  dependencies: ResourceBridgeDependencies = {},
): Promise<ResolveStepResourcesResult> {
  const topics = stepTopics(input.gap, input.roleDef);
  if (topics.length === 0) return { resources: [], resourceStatus: 'NONE' };

  const resolverInput: ResolveResourcesInput = {
    query: stepQuery(input.gap, input.roleDef),
    topics,
    useCase: input.gap.useCase,
    level: stepLevel(input.competency),
    limit: 3,
    workspaceId: `learning-plan:${input.planId}`,
    userId: input.userId,
    signal: input.signal,
  };

  const resolve = dependencies.resolve ?? resolveResources;
  try {
    const resolved = await resolve(resolverInput);
    const resources = resolved.map(toLearningResourceRecommendation);
    return { resources, resourceStatus: resources.length > 0 ? 'RESOLVED' : 'NONE' };
  } catch (error) {
    logger.warn('Learning path resource resolution failed closed', {
      planId: input.planId,
      gapId: input.gap.id,
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return { resources: [], resourceStatus: 'NONE' };
  }
}

export interface ResolveAllStepResourcesContext {
  planId: string;
  userId: string;
  signal: AbortSignal;
}

// Bounded by the caller's own step list (path-builder caps this); every
// step resolves independently under one shared AbortSignal so a slow or
// failed lookup for one step never blocks or fails the others.
export async function resolveAllStepResources(
  steps: ReadonlyArray<{ gap: Gap; roleDef: RoleDefinition; competency: RequiredCompetency }>,
  context: ResolveAllStepResourcesContext,
  dependencies: ResourceBridgeDependencies = {},
): Promise<ResolveStepResourcesResult[]> {
  return Promise.all(
    steps.map((step) =>
      resolveStepResources(
        { ...step, planId: context.planId, userId: context.userId, signal: context.signal },
        dependencies,
      ),
    ),
  );
}
