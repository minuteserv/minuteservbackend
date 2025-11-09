const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  throw new Error(
    'Missing JWT_SECRET environment variable. Generate a strong secret (at least 32 characters) and add it to your backend .env file.'
  );
}

const JWT_SECRET = process.env.JWT_SECRET.trim();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
// Refresh token: 365 days (effectively infinite until logout)
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '365d';

/**
 * Generate JWT access token
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN
  });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Decode token without verification (for debugging)
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken
};

