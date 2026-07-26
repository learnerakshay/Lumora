import type { ToolErrorCode } from './types';

export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: ToolErrorCode,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}
