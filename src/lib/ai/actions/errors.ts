export type AIActionErrorCode =
  | 'ACTION_NOT_FOUND'
  | 'INVALID_ACTION_INPUT'
  | 'ACTION_CONTEXT_MISSING'
  | 'ACTION_SOURCE_NOT_FOUND'
  | 'ACTION_SOURCE_NOT_READY'
  | 'UNSUPPORTED_COMPARISON'
  | 'ACTION_EXECUTION_FAILED';

export class AIActionError extends Error {
  constructor(
    message: string,
    public readonly code: AIActionErrorCode,
    public readonly statusCode = 422,
  ) {
    super(message);
    this.name = 'AIActionError';
  }
}
