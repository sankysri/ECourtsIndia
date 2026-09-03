import { errorResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error on ${req.method} ${req.url}:`, err);

  // Zod Validation Error
  if (err.name === 'ZodError') {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return errorResponse(res, 'Validation failed', 'VALIDATION_ERROR', details, 400);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid authentication token', 'UNAUTHORIZED', [], 401);
  }
  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Authentication token has expired', 'TOKEN_EXPIRED', [], 401);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';
  const details = err.details || [];

  return errorResponse(res, message, code, details, statusCode);
};

export const notFoundHandler = (req, res) => {
  return errorResponse(res, `Resource not found: ${req.method} ${req.path}`, 'NOT_FOUND', [], 404);
};
