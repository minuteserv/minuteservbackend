const supabase = require('../../config/supabase');
const bcrypt = require('bcryptjs');
const { generateAccessToken } = require('../../utils/jwt');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Admin login
 */
async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, { message: 'Email and password are required' }, 400);
    }

    // Get admin user
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !admin) {
      return errorResponse(res, { message: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return errorResponse(res, { message: 'Invalid credentials' }, 401);
    }

    // Generate token
    const tokenPayload = {
      adminId: admin.id,
      email: admin.email,
      role: admin.role
    };

    const token = generateAccessToken(tokenPayload);

    // Update last login
    await supabase
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    return successResponse(res, {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  adminLogin
};

