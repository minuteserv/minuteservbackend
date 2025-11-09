const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  logger.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Handle known errors
  if (err.name === 'ValidationError') {
    return errorResponse(res, { message: err.message }, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, { message: 'Invalid token' }, 401);
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, { message: 'Token expired' }, 401);
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  return errorResponse(res, { message }, statusCode);
}

module.exports = errorHandler;

