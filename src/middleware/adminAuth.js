const bcrypt = require('bcryptjs');
const { verifyToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Admin authentication middleware
 */
async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, { message: 'Authorization token required' }, 401);
    }

    const token = authHeader.substring(7);
    
    // Development mode: Allow mock token for hardcoded admin login
    // TODO: Remove this in production and use real JWT tokens
    if (process.env.NODE_ENV !== 'production' && token === 'mock-admin-token') {
      req.admin = {
        id: 'admin-1',
        username: 'admin',
        role: 'admin'
      };
      return next();
    }

    // Production: Verify JWT token
    const decoded = verifyToken(token);

    // Check if user is admin (you can add role check here)
    req.admin = {
      id: decoded.adminId || decoded.id,
      email: decoded.email,
      role: decoded.role || 'admin'
    };

    next();
  } catch (error) {
    logger.error('Admin auth middleware error:', error);
    return errorResponse(res, { message: 'Invalid or expired token' }, 401);
  }
}

module.exports = { adminAuth };

