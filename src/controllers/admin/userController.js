const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Get all users (customers) - Admin
 */
async function getAdminUsers(req, res) {
  try {
    const { is_verified, search } = req.query;

    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (is_verified !== undefined) {
      query = query.eq('is_verified', is_verified === 'true');
    }

    if (search) {
      query = query.or(`phone_number.ilike.%${search}%,name.ilike.%${search}%`);
    }

    const { data: users, error } = await query.limit(100);

    if (error) {
      logger.error('Get admin users error:', error);
      throw new Error('Failed to fetch users');
    }

    return successResponse(res, users || []);
  } catch (error) {
    logger.error('Get admin users error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get user by ID - Admin
 */
async function getAdminUserById(req, res) {
  try {
    const { id } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) {
      return errorResponse(res, { message: 'User not found' }, 404);
    }

    // Get user addresses
    const { data: addresses } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', id);

    // Get booking count
    const { count: bookingCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id);

    // Get total spent
    const { data: bookings } = await supabase
      .from('bookings')
      .select('grand_total')
      .eq('user_id', id)
      .eq('payment_status', 'paid');

    const totalSpent = bookings?.reduce((sum, b) => sum + parseFloat(b.grand_total || 0), 0) || 0;

    return successResponse(res, {
      ...user,
      addresses: addresses || [],
      booking_count: bookingCount || 0,
      total_spent: totalSpent,
    });
  } catch (error) {
    logger.error('Get admin user by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get user bookings - Admin
 */
async function getAdminUserBookings(req, res) {
  try {
    const { id } = req.params;

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*, partners(id, name, partner_code)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Get admin user bookings error:', error);
      throw new Error('Failed to fetch user bookings');
    }

    return successResponse(res, bookings || []);
  } catch (error) {
    logger.error('Get admin user bookings error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminUsers,
  getAdminUserById,
  getAdminUserBookings,
};

