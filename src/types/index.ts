export type SourceType = 'PDF' | 'WEBSITE' | 'YOUTUBE' | 'VTT' | 'TEXT';
export type SourceStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type MessageStatus = 'SENDING' | 'SUCCESS' | 'ERROR';
export type AnswerMode = 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';
export const CHAT_RESPONSE_MODES = ['GENERAL', 'GROUNDED'] as const;
export type ChatResponseMode = (typeof CHAT_RESPONSE_MODES)[number];
export function isChatResponseMode(value: unknown): value is ChatResponseMode {
  return CHAT_RESPONSE_MODES.some((mode) => mode === value);
}

export interface ChatStreamEvent {
  type:
    | 'user_persisted'
    | 'start'
    | 'chunk'
    | 'tool_status'
    | 'web_sources'
    | 'done'
    | 'error';
  responseMode?: ChatResponseMode | null;
  [key: string]: unknown;
}
export type CitationKind = 'DOCUMENT' | 'WEB' | 'CALCULATION';

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected' | 'disabled';
  environment: string;
  timestamp: string;
  version: string;
}
