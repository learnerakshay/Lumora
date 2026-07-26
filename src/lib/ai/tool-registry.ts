import type {
  ModelToolDefinition,
  ToolDefinition,
} from './types';

const TOOL_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<any, any>>();

  register<TArguments, TResult extends import('./types').JsonValue>(
    definition: ToolDefinition<TArguments, TResult>,
  ): () => void {
    if (!TOOL_NAME_PATTERN.test(definition.name)) {
      throw new Error(`Invalid tool name: ${definition.name}`);
    }
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool is already registered: ${definition.name}`);
    }
    if (!definition.description.trim()) {
      throw new Error(`Tool description is required: ${definition.name}`);
    }
    if (definition.parameters.type !== 'object') {
      throw new Error(`Tool parameters must use an object schema: ${definition.name}`);
    }
    if (
      definition.timeoutMs !== undefined &&
      (!Number.isInteger(definition.timeoutMs) ||
        definition.timeoutMs < 100 ||
        definition.timeoutMs > 120_000)
    ) {
      throw new Error(`Tool timeout must be between 100 and 120,000 ms: ${definition.name}`);
    }
    this.tools.set(definition.name, definition);
    return () => {
      if (this.tools.get(definition.name) === definition) {
        this.tools.delete(definition.name);
      }
    };
  }

  get(name: string): ToolDefinition<any, any> | undefined {
    return this.tools.get(name);
  }

  definitions(): ModelToolDefinition[] {
    return [...this.tools.values()].map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    }));
  }
}

export const aiToolRegistry = new ToolRegistry();
