/**
 * Standardized API response helper
 */
function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function errorResponse(res, error, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: error.message || error || 'An error occurred'
  });
}

function paginatedResponse(res, data, pagination, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination
  });
}

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse
};

