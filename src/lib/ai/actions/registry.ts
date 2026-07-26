import type { AIActionId } from './catalog';
import type { AIActionDefinition } from './types';

export class AIActionRegistry {
  private readonly actions = new Map<AIActionId, AIActionDefinition<any>>();

  register<TInput>(definition: AIActionDefinition<TInput>): () => void {
    const actionId = definition.metadata.id;
    if (this.actions.has(actionId)) {
      throw new Error(`AI action is already registered: ${actionId}`);
    }
    this.actions.set(actionId, definition);
    return () => {
      if (this.actions.get(actionId) === definition) {
        this.actions.delete(actionId);
      }
    };
  }

  get(actionId: AIActionId): AIActionDefinition<any> | undefined {
    return this.actions.get(actionId);
  }

  metadata() {
    return [...this.actions.values()].map(({ metadata }) => metadata);
  }
}
