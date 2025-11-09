const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Get admin dashboard stats
 */
async function getAdminDashboard(req, res) {
  try {
    // Get total bookings
    const { count: totalBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true });

    // Get bookings by status
    const { count: pendingBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: confirmedBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed');

    const { count: completedBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Get revenue
    const { data: revenueData } = await supabase
      .from('bookings')
      .select('grand_total')
      .eq('payment_status', 'paid');

    const totalRevenue = revenueData?.reduce((sum, b) => sum + parseFloat(b.grand_total || 0), 0) || 0;

    // Today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayRevenueData } = await supabase
      .from('bookings')
      .select('grand_total')
      .eq('payment_status', 'paid')
      .gte('created_at', today.toISOString());

    const todayRevenue = todayRevenueData?.reduce((sum, b) => sum + parseFloat(b.grand_total || 0), 0) || 0;

    // Get active partners
    const { count: activePartners } = await supabase
      .from('partners')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: totalPartners } = await supabase
      .from('partners')
      .select('*', { count: 'exact', head: true });

    // Get recent bookings
    const { data: recentBookings } = await supabase
      .from('bookings')
      .select('id, booking_number, status, booking_date, grand_total, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    return successResponse(res, {
      stats: {
        total_bookings: totalBookings || 0,
        pending_bookings: pendingBookings || 0,
        confirmed_bookings: confirmedBookings || 0,
        completed_bookings: completedBookings || 0,
        total_revenue: totalRevenue,
        today_revenue: todayRevenue,
        active_partners: activePartners || 0,
        total_partners: totalPartners || 0
      },
      recent_bookings: recentBookings || []
    });
  } catch (error) {
    logger.error('Get admin dashboard error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminDashboard
};

