import "server-only";

export type ErrorCode =
  "VALIDATION_ERROR" | "NOT_FOUND" | "DATABASE_ERROR" | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
