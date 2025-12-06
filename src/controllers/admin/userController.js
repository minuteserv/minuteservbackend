const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Get all users (customers) - Admin with stats
 */
async function getAdminUsers(req, res) {
  try {
    const { is_verified, is_active, search } = req.query;

    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (is_verified !== undefined) {
      query = query.eq('is_verified', is_verified === 'true');
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    if (search) {
      query = query.or(`phone_number.ilike.%${search}%,name.ilike.%${search}%`);
    }

    const { data: users, error } = await query.limit(100);

    if (error) {
      logger.error('Get admin users error:', error);
      throw new Error('Failed to fetch users');
    }

    // Get booking stats for each user
    const usersWithStats = await Promise.all(
      (users || []).map(async (user) => {
        // Get booking count and total spent
        const { data: bookings } = await supabase
          .from('bookings')
          .select('grand_total, payment_status')
          .eq('user_id', user.id);

        const bookingCount = bookings?.length || 0;
        const totalSpent = bookings
          ?.filter(b => b.payment_status === 'paid')
          ?.reduce((sum, b) => sum + parseFloat(b.grand_total || 0), 0) || 0;

        return {
          ...user,
          booking_count: bookingCount,
          total_spent: totalSpent,
        };
      })
    );

    return successResponse(res, usersWithStats);
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

/**
 * Block/Unblock user - Admin
 */
async function toggleUserBlock(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return errorResponse(res, { message: 'is_active must be a boolean' }, 400);
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Toggle user block error:', error);
      throw new Error('Failed to update user status');
    }

    if (!user) {
      return errorResponse(res, { message: 'User not found' }, 404);
    }

    const action = is_active ? 'unblocked' : 'blocked';
    logger.info(`User ${id} has been ${action} by admin`);

    return successResponse(res, user, `User ${action} successfully`);
  } catch (error) {
    logger.error('Toggle user block error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get customer stats - Admin
 */
async function getCustomerStats(req, res) {
  try {
    // Total customers
    const { count: totalCustomers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Active customers (not blocked)
    const { count: activeCustomers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Blocked customers
    const { count: blockedCustomers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false);

    // New this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const { count: newThisMonth } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());

    // Customers with bookings in last 30 days (active users)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentBookings } = await supabase
      .from('bookings')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const activeInLast30Days = new Set(recentBookings?.map(b => b.user_id) || []).size;

    return successResponse(res, {
      total: totalCustomers || 0,
      active: activeCustomers || 0,
      blocked: blockedCustomers || 0,
      new_this_month: newThisMonth || 0,
      active_last_30_days: activeInLast30Days,
    });
  } catch (error) {
    logger.error('Get customer stats error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminUsers,
  getAdminUserById,
  getAdminUserBookings,
  toggleUserBlock,
  getCustomerStats,
};

