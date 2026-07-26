import type { AIActionId, AIActionMetadata, AIActionTarget } from './catalog';

export interface AIActionRequest {
  actionId: AIActionId;
  input?: {
    target?: AIActionTarget;
    sourceId?: string;
    sourceIds?: string[];
    subject?: string;
    level?: 'beginner' | 'detailed';
  };
}

export interface AIActionSource {
  id: string;
  title: string;
  type: 'PDF' | 'WEBSITE' | 'TEXT' | 'YOUTUBE' | 'VTT';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export interface AIActionConversationItem {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface AIActionContext {
  workspaceId: string;
  userId: string;
  sources: AIActionSource[];
  conversation: AIActionConversationItem[];
}

export interface AIActionExecutionPlan {
  actionId: AIActionId;
  actionLabel: string;
  target: AIActionTarget;
  displayMessage: string;
  retrievalQuery: string;
  modelPrompt: string;
  additionalInstructions: string;
  sourceIds: string[];
  allowWithoutWorkspaceContext: boolean;
}

export interface AIActionDefinition<TInput = unknown> {
  metadata: AIActionMetadata;
  validate: (input: unknown, context: AIActionContext) => TInput;
  execute: (
    input: TInput,
    context: AIActionContext,
  ) => Promise<AIActionExecutionPlan>;
}
