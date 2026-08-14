import type { RequestHandler } from 'express';
import { errorResponse } from './api-response';
import { AppError } from './errors';

export const apiNotFoundHandler: RequestHandler = (_req, res) => {
  const response = errorResponse(
    AppError.notFound('API endpoint not found', 'API_ROUTE_NOT_FOUND'),
  );
  return res.status(response.statusCode).json(response.payload);
};
