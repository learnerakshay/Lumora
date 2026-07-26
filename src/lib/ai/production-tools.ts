import { getServerEnv } from '../env';
import { aiToolRegistry } from './tool-registry';
import {
  createTavilySearchTool,
  TAVILY_TOOL_NAME,
} from './tools/tavily-search';

let tavilyRegistered = false;

export function ensureProductionAITools(): void {
  if (tavilyRegistered) return;
  const env = getServerEnv();
  if (!env.TAVILY_API_KEY?.trim()) return;
  aiToolRegistry.register(
    createTavilySearchTool({
      apiKey: env.TAVILY_API_KEY,
      maxResults: env.TAVILY_MAX_RESULTS,
      timeoutMs: env.TAVILY_TIMEOUT_MS,
    }),
  );
  tavilyRegistered = true;
}

export function isTavilySearchAvailable(): boolean {
  ensureProductionAITools();
  return Boolean(aiToolRegistry.get(TAVILY_TOOL_NAME));
}
