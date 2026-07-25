export type SourceType = 'PDF' | 'WEBSITE' | 'YOUTUBE' | 'VTT' | 'TEXT';
export type SourceStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type MessageStatus = 'SENDING' | 'SUCCESS' | 'ERROR';
export type AnswerMode = 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';
export type CitationKind = 'DOCUMENT' | 'WEB' | 'CALCULATION';

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected' | 'disabled';
  environment: string;
  timestamp: string;
  version: string;
}
