import { logger } from '../../logger';
import { AIActionError } from './errors';
import { AIActionRegistry } from './registry';
import type {
  AIActionContext,
  AIActionExecutionPlan,
  AIActionRequest,
} from './types';

export class AIActionExecutor {
  constructor(private readonly registry: AIActionRegistry) {}

  async execute(
    request: AIActionRequest,
    context: AIActionContext,
  ): Promise<AIActionExecutionPlan> {
    const startedAt = Date.now();
    const definition = this.registry.get(request.actionId);
    if (!definition) {
      throw new AIActionError(
        `AI action "${String(request.actionId)}" is not available.`,
        'ACTION_NOT_FOUND',
        404,
      );
    }
    logger.debug('AI action invoked', {
      workspaceId: context.workspaceId,
      actionId: request.actionId,
    });
    try {
      const validated = definition.validate(request.input, context);
      const result = await definition.execute(validated, context);
      logger.debug('AI action completed', {
        workspaceId: context.workspaceId,
        actionId: request.actionId,
        durationMs: Date.now() - startedAt,
        target: result.target,
      });
      return result;
    } catch (error) {
      const failureMetadata = {
        workspaceId: context.workspaceId,
        actionId: request.actionId,
        durationMs: Date.now() - startedAt,
        code:
          error instanceof AIActionError
            ? error.code
            : 'ACTION_EXECUTION_FAILED',
      };
      if (error instanceof AIActionError) {
        logger.debug('AI action validation failed', failureMetadata);
      } else {
        logger.warn('AI action execution failed', failureMetadata);
      }
      if (error instanceof AIActionError) throw error;
      throw new AIActionError(
        'The AI action could not be prepared.',
        'ACTION_EXECUTION_FAILED',
        500,
      );
    }
  }
}
