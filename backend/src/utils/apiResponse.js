/**
 * Standard API Response Utilities
 * Matches required schema:
 * Success: { success: true, message: "", data: {} }
 * Error:   { success: false, message: "", error: { code: "", details: [] } }
 */

export const successResponse = (res, message = 'Success', data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (res, message = 'An error occurred', code = 'INTERNAL_ERROR', details = [], statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      details: Array.isArray(details) ? details : [details],
    },
  });
};
