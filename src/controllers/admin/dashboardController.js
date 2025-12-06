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

    // Get total customers
    const { count: totalCustomers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

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

    // This month's revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const { data: monthRevenueData } = await supabase
      .from('bookings')
      .select('grand_total')
      .eq('payment_status', 'paid')
      .gte('created_at', startOfMonth.toISOString());

    const monthRevenue = monthRevenueData?.reduce((sum, b) => sum + parseFloat(b.grand_total || 0), 0) || 0;

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
      .select('id, booking_number, status, booking_date, booking_time, grand_total, created_at, customer_name')
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
        month_revenue: monthRevenue,
        active_partners: activePartners || 0,
        total_partners: totalPartners || 0,
        total_customers: totalCustomers || 0,
      },
      recent_bookings: recentBookings || []
    });
  } catch (error) {
    logger.error('Get admin dashboard error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get chart data for last 7 days
 */
async function getChartData(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const chartData = [];

    // Generate data for last N days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Get bookings for this day
      const { count: bookingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      // Get revenue for this day
      const { data: dayRevenue } = await supabase
        .from('bookings')
        .select('grand_total')
        .eq('payment_status', 'paid')
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      const revenue = dayRevenue?.reduce((sum, b) => sum + parseFloat(b.grand_total || 0), 0) || 0;

      chartData.push({
        date: date.toISOString().split('T')[0],
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        bookings: bookingCount || 0,
        revenue: revenue,
      });
    }

    return successResponse(res, chartData);
  } catch (error) {
    logger.error('Get chart data error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get today's schedule
 */
async function getTodaySchedule(req, res) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const { data: todayBookings, error } = await supabase
      .from('bookings')
      .select(`
        id, 
        booking_number, 
        status, 
        booking_date, 
        booking_time, 
        grand_total, 
        customer_name, 
        customer_phone,
        partners(id, name, phone_number)
      `)
      .eq('booking_date', todayStr)
      .in('status', ['pending', 'confirmed', 'in_progress'])
      .order('booking_time', { ascending: true });

    if (error) {
      logger.error('Get today schedule error:', error);
      throw new Error('Failed to fetch today schedule');
    }

    return successResponse(res, todayBookings || []);
  } catch (error) {
    logger.error('Get today schedule error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get service category breakdown
 */
async function getCategoryBreakdown(req, res) {
  try {
    // Get all bookings with their services
    const { data: bookings } = await supabase
      .from('bookings')
      .select('booking_items')
      .eq('payment_status', 'paid');

    // Count services by category
    const categoryCount = {};
    const categoryRevenue = {};

    bookings?.forEach(booking => {
      const items = booking.booking_items || [];
      items.forEach(item => {
        const category = item.category || 'Other';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
        categoryRevenue[category] = (categoryRevenue[category] || 0) + parseFloat(item.price || 0);
      });
    });

    const breakdown = Object.keys(categoryCount).map(category => ({
      category,
      count: categoryCount[category],
      revenue: categoryRevenue[category],
    }));

    // Sort by count descending
    breakdown.sort((a, b) => b.count - a.count);

    return successResponse(res, breakdown);
  } catch (error) {
    logger.error('Get category breakdown error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminDashboard,
  getChartData,
  getTodaySchedule,
  getCategoryBreakdown,
};

