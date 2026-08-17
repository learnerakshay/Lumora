import { Router, Request, Response } from 'express';
import { requireApiAuth } from '../lib/auth';
import { AppError } from '../lib/errors';
import { successResponse, errorResponse } from '../lib/api-response';
import { logger } from '../lib/logger';
import { checkAndReserve, commitUsage, discardUsage } from '../lib/usage/service';
import { usageLimitError } from '../lib/usage/errors';
import { getLatestSkillProfile } from '../lib/skills/skill-profile-store';
import { buildLearningPath, selectableGaps } from '../lib/learning/path-builder';
import { LEARNING_ENGINE_VERSION } from '../lib/learning/types';
import {
  createBuildingLearningPlan,
  createLearningWorkspaceLink,
  deleteLearningPlanForUser,
  getLatestLearningPlan,
  getLearningPlanForUser,
  markLearningPlanFailed,
  markLearningPlanReady,
} from '../lib/learning/learning-plan-store';
import { createWorkspace, getWorkspaceById } from '../lib/workspace-store';

export const learningRouter = Router();

learningRouter.use(requireApiAuth);

learningRouter.post('/plan', async (req: Request, res: Response) => {
  const userId = res.locals.userId;
  let usageEventId: string | null = null;
  let planId: string | null = null;
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    const roleId = typeof req.body?.roleId === 'string' ? req.body.roleId.trim() : '';
    const rawGapIds: unknown = req.body?.gapIds;
    const gapIds: string[] = Array.isArray(rawGapIds)
      ? rawGapIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    if (!roleId) {
      const response = errorResponse(AppError.badRequest('A target role is required.', 'LEARNING_ROLE_REQUIRED'));
      return res.status(response.statusCode).json(response.payload);
    }
    if (gapIds.length === 0) {
      const response = errorResponse(AppError.badRequest('Select at least one gap to build a learning plan.', 'LEARNING_GAPS_REQUIRED'));
      return res.status(response.statusCode).json(response.payload);
    }

    const latest = await getLatestSkillProfile(userId);
    if (!latest || latest.profile.status !== 'READY' || !latest.analysis) {
      const response = errorResponse(
        AppError.badRequest('No completed Role Analysis is available to build a learning plan from.', 'LEARNING_ANALYSIS_NOT_READY'),
      );
      return res.status(response.statusCode).json(response.payload);
    }
    const analysis = latest.analysis;

    const role = analysis.gaps.roles.find((candidate) => candidate.roleId === roleId);
    if (!role) {
      const response = errorResponse(
        AppError.badRequest('The selected role is not part of the current Role Analysis.', 'LEARNING_ROLE_NOT_IN_ANALYSIS'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const uniqueGapIds = [...new Set(gapIds)];
    const matchedGaps = selectableGaps(analysis.gaps, roleId, uniqueGapIds);
    if (matchedGaps.length !== uniqueGapIds.length) {
      const response = errorResponse(
        AppError.badRequest('One or more selected gaps are not part of the current Role Analysis.', 'LEARNING_GAP_NOT_IN_ANALYSIS'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const reservation = await checkAndReserve(userId, 'LEARNING_PATH');
    if ('details' in reservation) {
      const response = errorResponse(usageLimitError(reservation.details));
      return res.status(response.statusCode).json(response.payload);
    }
    usageEventId = reservation.usageEventId;

    const buildingPlan = await createBuildingLearningPlan({
      userId,
      analysisId: analysis.id,
      roleId,
      engineVersion: LEARNING_ENGINE_VERSION,
      selectedGapIds: uniqueGapIds,
    });
    planId = buildingPlan.id;

    let built;
    try {
      built = await buildLearningPath({
        analysisId: analysis.id,
        roleId,
        gapReport: analysis.gaps,
        selectedGapIds: uniqueGapIds,
        planId: buildingPlan.id,
        userId,
        signal: abortController.signal,
      });
    } catch (error) {
      await markLearningPlanFailed(
        buildingPlan.id,
        'An unexpected error interrupted Learning Path generation.',
      ).catch(() => {});
      await discardUsage(usageEventId);
      usageEventId = null;
      logger.error('Learning plan build failed', error, { userId, roleId });
      const response = errorResponse(
        new AppError('Could not build a learning plan for this role right now.', 502, 'LEARNING_PLAN_BUILD_FAILED'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const readyPlan = await markLearningPlanReady(buildingPlan.id, {
      path: built.path,
      readiness: built.readiness,
      narrativeModel: built.narrativeModel,
    });

    await commitUsage(usageEventId, {
      provider: built.narrativeModel ? 'openai' : null,
      model: built.narrativeModel,
      inputTokens: built.narrativeUsage?.inputTokens ?? null,
      outputTokens: built.narrativeUsage?.outputTokens ?? null,
    });
    usageEventId = null;

    return res.status(200).json(successResponse({ plan: readyPlan }));
  } catch (error) {
    if (usageEventId) await discardUsage(usageEventId).catch(() => {});
    if (planId) {
      await markLearningPlanFailed(
        planId,
        'An unexpected error interrupted Learning Path generation.',
      ).catch(() => {});
    }
    logger.error('Learning plan creation failed', error, { userId });
    const response = errorResponse(error);
    return res.status(response.statusCode).json(response.payload);
  }
});

learningRouter.get('/plan', async (req: Request, res: Response) => {
  try {
    const latest = await getLatestLearningPlan(res.locals.userId);
    return res.status(200).json(successResponse(latest));
  } catch (error) {
    logger.error('Failed to fetch Learning Plan', error, { userId: res.locals.userId });
    const response = errorResponse(new Error('Failed to retrieve Learning Plan'));
    return res.status(response.statusCode).json(response.payload);
  }
});

learningRouter.get('/plan/:id', async (req: Request, res: Response) => {
  try {
    const plan = await getLearningPlanForUser(req.params.id, res.locals.userId);
    if (!plan) {
      const response = errorResponse(AppError.notFound('Learning Plan not found.', 'LEARNING_PLAN_NOT_FOUND'));
      return res.status(response.statusCode).json(response.payload);
    }
    return res.status(200).json(successResponse(plan));
  } catch (error) {
    logger.error('Failed to fetch Learning Plan', error, { userId: res.locals.userId, planId: req.params.id });
    const response = errorResponse(new Error('Failed to retrieve Learning Plan'));
    return res.status(response.statusCode).json(response.payload);
  }
});

// Creates an empty Workspace for a READY plan and links it — never ingests
// any recommended resource. This handler must never import from
// lib/ingestion/* and must never read plan.path[].resources: recommendations
// are display data only and can never become Workspace evidence.
learningRouter.post('/plan/:id/workspace', async (req: Request, res: Response) => {
  const userId = res.locals.userId;
  try {
    const plan = await getLearningPlanForUser(req.params.id, userId);
    if (!plan) {
      const response = errorResponse(AppError.notFound('Learning Plan not found.', 'LEARNING_PLAN_NOT_FOUND'));
      return res.status(response.statusCode).json(response.payload);
    }
    if (plan.status !== 'READY' || !plan.path) {
      const response = errorResponse(
        AppError.badRequest('This learning plan is not ready yet.', 'LEARNING_PLAN_NOT_READY'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const existingLink = plan.workspaceLinks[0];
    if (existingLink) {
      const existingWorkspace = await getWorkspaceById(existingLink.workspaceId, userId);
      if (existingWorkspace) {
        return res.status(200).json(successResponse({ workspace: existingWorkspace, created: false }));
      }
    }

    const workspace = await createWorkspace({
      name: `${plan.path.roleTitle} — Learning Plan`,
      description: 'Created from a Learning Path. Starts empty — add your own sources as you learn.',
      icon: 'learning',
      userId,
    });
    await createLearningWorkspaceLink({ planId: plan.id, workspaceId: workspace.id });

    return res.status(201).json(successResponse({ workspace, created: true }));
  } catch (error) {
    logger.error('Failed to create Learning Workspace', error, { userId, planId: req.params.id });
    const response = errorResponse(new Error('Failed to create Learning Workspace'));
    return res.status(response.statusCode).json(response.payload);
  }
});

learningRouter.delete('/plan/:id', async (req: Request, res: Response) => {
  try {
    const deletedCount = await deleteLearningPlanForUser(req.params.id, res.locals.userId);
    return res.status(200).json(successResponse({ deleted: deletedCount > 0 }));
  } catch (error) {
    logger.error('Failed to delete Learning Plan', error, { userId: res.locals.userId, planId: req.params.id });
    const response = errorResponse(new Error('Failed to delete Learning Plan'));
    return res.status(response.statusCode).json(response.payload);
  }
});
