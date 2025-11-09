const { verifyToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
async function auth(req, res, next) {
  try {
    let token = null;

    // Try to get token from Authorization header first (for backward compatibility)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    } else {
      // Get token from HttpOnly cookie (preferred method)
      token = req.cookies?.access_token || null;
    }

    if (!token) {
      return errorResponse(res, { message: 'Authorization token required' }, 401);
    }

    // Verify token
    const decoded = verifyToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.userId || decoded.id,
      phone_number: decoded.phone_number
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return errorResponse(res, { message: 'Invalid or expired token' }, 401);
  }
}

module.exports = { auth };

