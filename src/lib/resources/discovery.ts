import { randomUUID } from 'node:crypto';
import { ensureProductionAITools } from '../ai/production-tools';
import { ToolExecutor } from '../ai/tool-executor';
import { aiToolRegistry } from '../ai/tool-registry';
import { TAVILY_TOOL_NAME } from '../ai/tools/tavily-search';
import type { WebSource } from '../ai/types';

export interface ResourceDiscoveryInput {
  query: string;
  workspaceId: string;
  userId: string;
  signal: AbortSignal;
  limit: number;
}

export interface ResourceDiscoveryProvider {
  discover(input: ResourceDiscoveryInput): Promise<WebSource[]>;
}

function validWebSources(value: unknown): WebSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is WebSource => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const source = candidate as Record<string, unknown>;
    if (
      typeof source.title !== 'string' ||
      !source.title.trim() ||
      typeof source.url !== 'string' ||
      typeof source.snippet !== 'string' ||
      !source.snippet.trim() ||
      typeof source.score !== 'number' ||
      !Number.isFinite(source.score)
    ) return false;
    try {
      return new URL(source.url).protocol === 'https:';
    } catch {
      return false;
    }
  });
}

export class TavilyResourceDiscovery implements ResourceDiscoveryProvider {
  async discover(input: ResourceDiscoveryInput): Promise<WebSource[]> {
    ensureProductionAITools();
    if (!aiToolRegistry.get(TAVILY_TOOL_NAME)) return [];
    const execution = await new ToolExecutor(aiToolRegistry).execute(
      {
        id: `resource_${randomUUID()}`,
        name: TAVILY_TOOL_NAME,
        arguments: { query: input.query, maxResults: input.limit, topic: 'general' },
        rawArguments: JSON.stringify({
          query: input.query,
          maxResults: input.limit,
          topic: 'general',
        }),
      },
      {
        workspaceId: input.workspaceId,
        userId: input.userId,
        signal: input.signal,
        metadata: { purpose: 'learning_resource_discovery' },
      },
    );
    if (!execution.succeeded || !execution.response.output) return [];
    const output = execution.response.output;
    if (!output || typeof output !== 'object' || Array.isArray(output)) return [];
    return validWebSources((output as Record<string, unknown>).results);
  }
}

export const tavilyResourceDiscovery = new TavilyResourceDiscovery();
