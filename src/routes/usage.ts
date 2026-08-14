import { Router } from 'express';
import { requireApiAuth } from '../lib/auth';
import { errorResponse, successResponse } from '../lib/api-response';
import { logger } from '../lib/logger';
import { getUsageSummary } from '../lib/usage/service';

export const usageRouter = Router();

usageRouter.use(requireApiAuth);

usageRouter.get('/', async (_req, res) => {
  try {
    const summary = await getUsageSummary(res.locals.userId);
    return res.status(200).json(successResponse(summary));
  } catch (error) {
    logger.error('Failed to retrieve usage summary', error, {
      userId: res.locals.userId,
    });
    const response = errorResponse(new Error('Failed to retrieve usage summary'));
    return res.status(response.statusCode).json(response.payload);
  }
});
