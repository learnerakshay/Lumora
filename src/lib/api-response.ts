import { AppError } from './errors';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(error: unknown): { statusCode: number; payload: ApiResponse } {
  const timestamp = new Date().toISOString();

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      payload: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
        timestamp,
      },
    };
  }

  // Handle generic unknown errors safely without leaking internal traces or secrets
  return {
    statusCode: 500,
    payload: {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
      },
      timestamp,
    },
  };
}
