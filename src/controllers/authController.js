const supabase = require('../config/supabase');
const { sendOTP, verifyOTP } = require('../services/interaktOTPService');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Send OTP to phone number
 */
async function sendOTPHandler(req, res) {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return errorResponse(res, { message: 'Phone number is required' }, 400);
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone_number)) {
      return errorResponse(res, { message: 'Invalid phone number format' }, 400);
    }

    const result = await sendOTP(phone_number);

    return successResponse(res, {
      expires_in: result.expires_in,
      ...(result.warning && { warning: result.warning }),
      ...(result.message_sid && { message_sid: result.message_sid }),
      ...(result.otp_code && { otp_code: result.otp_code }) // Include OTP in dev mode for testing
    }, 'OTP sent successfully');
  } catch (error) {
    logger.error('Send OTP handler error:', error);
    const statusCode = error.message.includes('limit') ? 429 : 
                      error.message.includes('verified') ? 400 : 500;
    return errorResponse(res, error, statusCode);
  }
}

/**
 * Verify OTP and create/login user
 */
async function verifyOTPHandler(req, res) {
  try {
    const { phone_number, otp_code } = req.body;

    if (!phone_number || !otp_code) {
      return errorResponse(res, { message: 'Phone number and OTP code are required' }, 400);
    }

    // Verify OTP
    await verifyOTP(phone_number, otp_code);

    // Get or create user
    let user;
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone_number)
      .single();

    // If error is not "not found", log it
    if (findError && findError.code !== 'PGRST116') {
      logger.error('Find user error:', findError);
    }

    if (existingUser) {
      // Update last login
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          is_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) {
        logger.error('Update user error:', updateError);
        // Continue with existing user if update fails
        user = existingUser;
      } else {
        user = updatedUser || existingUser;
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          phone_number,
          is_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        logger.error('Create user error:', {
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          code: createError.code,
          fullError: createError
        });
        return errorResponse(res, {
          message: 'Failed to create user',
          error: createError.message,
          details: createError.details,
          hint: createError.hint
        }, 500);
      }

      if (!newUser) {
        logger.error('Create user returned no data');
        return errorResponse(res, { message: 'Failed to create user - no data returned' }, 500);
      }

      user = newUser;
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      phone_number: user.phone_number
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Set HttpOnly cookies for tokens
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      maxAge: 15 * 60 * 1000, // 15 minutes for access token
      path: '/',
    };

    const refreshCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 365 days for refresh token (effectively infinite until logout)
      path: '/',
    };

    res.cookie('access_token', accessToken, cookieOptions);
    res.cookie('refresh_token', refreshToken, refreshCookieOptions);

    return successResponse(res, {
      user: {
        id: user.id,
        phone_number: user.phone_number,
        name: user.name,
        email: user.email,
        is_verified: user.is_verified
      }
    }, 'OTP verified successfully');
  } catch (error) {
    logger.error('Verify OTP handler error:', error);
    return errorResponse(res, error, 400);
  }
}

/**
 * Refresh access token
 */
async function refreshTokenHandler(req, res) {
  try {
    // Get refresh token from cookie (preferred) or request body (backward compatibility)
    let refreshToken = req.cookies?.refresh_token || req.body?.refresh_token;

    if (!refreshToken) {
      return errorResponse(res, { message: 'Refresh token is required' }, 400);
    }

    const { verifyToken } = require('../utils/jwt');
    const decoded = verifyToken(refreshToken);

    // Generate new access token
    const tokenPayload = {
      userId: decoded.userId || decoded.id,
      phone_number: decoded.phone_number
    };

    const accessToken = generateAccessToken(tokenPayload);
    
    // Generate new refresh token (token rotation) to extend session indefinitely
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Set new access token cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    };
    
    // Set new refresh token cookie (365 days - effectively infinite until logout)
    const refreshCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 365 days
      path: '/',
    };

    res.cookie('access_token', accessToken, cookieOptions);
    res.cookie('refresh_token', newRefreshToken, refreshCookieOptions); // Rotate refresh token

    return successResponse(res, {
      message: 'Token refreshed successfully'
    }, 'Token refreshed successfully');
  } catch (error) {
    logger.error('Refresh token handler error:', error);
    return errorResponse(res, { message: 'Invalid or expired refresh token' }, 401);
  }
}

/**
 * Get current user
 */
async function getCurrentUser(req, res) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, phone_number, name, email, is_verified, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return errorResponse(res, { message: 'User not found' }, 404);
    }

    return successResponse(res, user);
  } catch (error) {
    logger.error('Get current user error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Logout - Clear authentication cookies
 */
async function logoutHandler(req, res) {
  try {
    // Clear both access and refresh token cookies
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    logger.error('Logout handler error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  sendOTPHandler,
  verifyOTPHandler,
  refreshTokenHandler,
  getCurrentUser,
  logoutHandler
};

