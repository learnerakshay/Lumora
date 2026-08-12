import { AIOrchestrationError } from '../ai/orchestrator';
import {
  ChatGenerationAbortedError,
  ChatProviderError,
} from './openai-provider';
import { CitationTrustError } from './conversation-store';

export type ChatLifecyclePhase =
  | 'request'
  | 'retrieval'
  | 'orchestration'
  | 'citation_validation'
  | 'persistence';

export interface ClassifiedChatFailure {
  code: string;
  phase: ChatLifecyclePhase;
  userMessage: string;
  intentionalCancellation: boolean;
}

interface ActiveGeneration {
  controller: AbortController;
  cancellationRequested: boolean;
  completion: Promise<void>;
  resolveCompletion: () => void;
}

function generationKey(workspaceId: string, userId: string, operationId: string): string {
  return `${workspaceId}:${userId}:${operationId}`;
}

export class ActiveChatGenerationRegistry {
  private readonly active = new Map<string, ActiveGeneration>();

  register(
    workspaceId: string,
    userId: string,
    operationId: string,
    controller: AbortController,
  ): boolean {
    const key = generationKey(workspaceId, userId, operationId);
    if (this.active.has(key)) return false;
    let resolveCompletion = () => undefined;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    this.active.set(key, {
      controller,
      cancellationRequested: false,
      completion,
      resolveCompletion,
    });
    return true;
  }

  cancel(workspaceId: string, userId: string, operationId: string): boolean {
    const generation = this.active.get(generationKey(workspaceId, userId, operationId));
    if (!generation) return false;
    generation.cancellationRequested = true;
    generation.controller.abort();
    return true;
  }

  async cancelAndWait(
    workspaceId: string,
    userId: string,
    operationId: string,
  ): Promise<boolean> {
    const generation = this.active.get(generationKey(workspaceId, userId, operationId));
    if (!generation) return false;
    generation.cancellationRequested = true;
    generation.controller.abort();
    await generation.completion;
    return true;
  }

  wasCancellationRequested(
    workspaceId: string,
    userId: string,
    operationId: string,
  ): boolean {
    return (
      this.active.get(generationKey(workspaceId, userId, operationId))
        ?.cancellationRequested === true
    );
  }

  unregister(workspaceId: string, userId: string, operationId: string): void {
    const key = generationKey(workspaceId, userId, operationId);
    this.active.get(key)?.resolveCompletion();
    this.active.delete(key);
  }
}

export const activeChatGenerations = new ActiveChatGenerationRegistry();

export const INSUFFICIENT_WORKSPACE_EVIDENCE_MESSAGE =
  "I couldn't find enough evidence in this Workspace to answer that reliably. Add or reprocess a relevant source, then try again.";

export function shouldReturnInsufficientWorkspaceEvidence(
  hasWorkspaceContext: boolean,
  allowWithoutWorkspaceContext: boolean,
): boolean {
  return !hasWorkspaceContext && !allowWithoutWorkspaceContext;
}

export function classifyChatLifecycleFailure(
  error: unknown,
  phase: ChatLifecyclePhase,
  intentionalCancellation: boolean,
): ClassifiedChatFailure {
  if (intentionalCancellation) {
    return {
      code: 'CHAT_CANCELLED',
      phase: 'orchestration',
      userMessage: 'Response generation was intentionally stopped.',
      intentionalCancellation: true,
    };
  }
  if (error instanceof ChatGenerationAbortedError) {
    return {
      code: 'PROVIDER_ABORTED',
      phase: 'orchestration',
      userMessage: 'The AI provider stopped before completing the response.',
      intentionalCancellation: false,
    };
  }
  if (error instanceof ChatProviderError) {
    return {
      code: error.code,
      phase: 'orchestration',
      userMessage: error.message,
      intentionalCancellation: false,
    };
  }
  if (error instanceof AIOrchestrationError) {
    return {
      code: error.code,
      phase: 'orchestration',
      userMessage: error.message,
      intentionalCancellation: false,
    };
  }
  if (error instanceof CitationTrustError) {
    return {
      code: error.code,
      phase: 'citation_validation',
      userMessage:
        error.code === 'CITATION_PROVENANCE_MISMATCH'
          ? 'The response citation no longer matched the validated Workspace evidence.'
          : 'The response citation metadata did not pass validation.',
      intentionalCancellation: false,
    };
  }

  const byPhase: Record<ChatLifecyclePhase, Omit<ClassifiedChatFailure, 'phase'>> = {
    request: {
      code: 'CHAT_REQUEST_FAILED',
      userMessage: 'The chat request could not be started.',
      intentionalCancellation: false,
    },
    retrieval: {
      code: 'RETRIEVAL_FAILED',
      userMessage: 'Unable to retrieve validated indexed knowledge for this Workspace.',
      intentionalCancellation: false,
    },
    orchestration: {
      code: 'ORCHESTRATION_FAILED',
      userMessage: 'The AI response workflow failed before completion.',
      intentionalCancellation: false,
    },
    citation_validation: {
      code: 'CITATION_VALIDATION_FAILED',
      userMessage: 'The generated response did not pass grounded-response validation.',
      intentionalCancellation: false,
    },
    persistence: {
      code: 'CHAT_PERSISTENCE_FAILED',
      userMessage: 'The completed response could not be saved safely.',
      intentionalCancellation: false,
    },
  };
  return { ...byPhase[phase], phase };
}
