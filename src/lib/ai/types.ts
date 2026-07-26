export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface ToolParameterSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export type ToolExecutionStatus =
  | 'requested'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'unsupported'
  | 'invalid';

export type ToolErrorCode =
  | 'INVALID_TOOL_ARGUMENTS'
  | 'TOOL_NOT_FOUND'
  | 'TOOL_EXECUTION_FAILED'
  | 'TOOL_EXECUTION_TIMEOUT'
  | 'TOOL_EXECUTION_CANCELLED'
  | 'TOOL_RATE_LIMITED'
  | 'TOOL_UNAVAILABLE'
  | 'TOOL_CONFIGURATION_ERROR'
  | 'TOOL_INVALID_RESPONSE'
  | 'ORCHESTRATION_LIMIT_REACHED';

export interface ToolError {
  code: ToolErrorCode;
  message: string;
  retryable: boolean;
  details?: JsonObject;
}

export interface ToolMetadata {
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  [key: string]: JsonValue | undefined;
}

export interface ToolRequest {
  id: string;
  name: string;
  arguments: unknown;
  rawArguments: string;
  argumentParseError?: string;
}

export interface ToolResponse {
  requestId: string;
  toolName: string;
  status: Exclude<ToolExecutionStatus, 'requested' | 'running'>;
  output?: JsonValue;
  error?: ToolError;
  metadata: ToolMetadata;
}

export interface ExecutionContext {
  userId: string;
  workspaceId: string;
  requestId: string;
  signal: AbortSignal;
  metadata?: JsonObject;
}

export interface ToolDefinition<TArguments = unknown, TResult extends JsonValue = JsonValue> {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  timeoutMs?: number;
  validate: (input: unknown) => TArguments;
  execute: (input: TArguments, context: ExecutionContext) => Promise<TResult>;
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolExecutionRecord {
  request: ToolRequest;
  response: ToolResponse;
}

export interface ExecutionResult {
  response: ToolResponse;
  succeeded: boolean;
}

export interface ToolStatusUpdate {
  requestId: string;
  toolName: string;
  status: ToolExecutionStatus;
}

export interface WebSource {
  title: string;
  url: string;
  snippet: string;
  score: number;
  publishedDate?: string;
}

export type IntelligenceMode = 'workspace_only' | 'web_only' | 'hybrid';

export interface OrchestrationMetadata {
  toolRounds: number;
  toolExecutions: ToolExecutionRecord[];
  intelligenceMode: IntelligenceMode;
  webSearchAttempted: boolean;
  webSources: WebSource[];
  webSearchFailure?: string;
}
