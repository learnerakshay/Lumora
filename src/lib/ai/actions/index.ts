import { BUILT_IN_ACTIONS } from './built-in-actions';
import { AIActionExecutor } from './executor';
import { AIActionRegistry } from './registry';
import type {
  AIActionContext,
  AIActionDefinition,
  AIActionRequest,
} from './types';

export const aiActionRegistry = new AIActionRegistry();
for (const action of BUILT_IN_ACTIONS) {
  aiActionRegistry.register(action as AIActionDefinition<any>);
}

export const aiActionExecutor = new AIActionExecutor(aiActionRegistry);

export function executeAIAction(
  request: AIActionRequest,
  context: AIActionContext,
) {
  return aiActionExecutor.execute(request, context);
}

export type {
  AIActionContext,
  AIActionExecutionPlan,
  AIActionRequest,
} from './types';
export { AIActionError } from './errors';
