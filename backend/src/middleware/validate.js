import { errorResponse } from '../utils/apiResponse.js';

export const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return errorResponse(res, 'Request validation failed', 'VALIDATION_ERROR', details, 400);
      }
      next(err);
    }
  };
};

export const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return errorResponse(res, 'Query parameter validation failed', 'VALIDATION_ERROR', details, 400);
      }
      next(err);
    }
  };
};
