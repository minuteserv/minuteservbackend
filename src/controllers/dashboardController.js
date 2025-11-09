const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get dashboard data (combined endpoint)
 */
async function getDashboard(req, res) {
  try {
    const userId = req.user.id;

    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, phone_number, name, email, is_verified, created_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return errorResponse(res, { message: 'User not found' }, 404);
    }

    // Get addresses
    const { data: addresses } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    // Get recent bookings (last 5)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, booking_number, status, booking_date, booking_time, grand_total, payment_status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    return successResponse(res, {
      user,
      addresses: addresses || [],
      recent_bookings: bookings || []
    });
  } catch (error) {
    logger.error('Get dashboard error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getDashboard
};

