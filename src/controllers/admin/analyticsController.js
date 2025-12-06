const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Get revenue by service category
 */
async function getRevenueByCategory(req, res) {
  try {
    const { date_from, date_to } = req.query;
    
    let query = supabase
      .from('bookings')
      .select('services, grand_total, created_at')
      .eq('status', 'completed')
      .eq('payment_status', 'paid');

    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    const { data: bookings, error } = await query;

    if (error) {
      logger.error('Get revenue by category error:', error);
      throw new Error('Failed to fetch bookings');
    }

    // Aggregate revenue by service category
    const categoryRevenue = {};
    
    (bookings || []).forEach(booking => {
      const items = Array.isArray(booking.services) ? booking.services : [];
      items.forEach(item => {
        const category = item.service_category || item.category || 'Other';
        const revenue = parseFloat(item.price || 0) * (item.quantity || 1);
        categoryRevenue[category] = (categoryRevenue[category] || 0) + revenue;
      });
    });

    // Convert to array format for charts
    const result = Object.entries(categoryRevenue).map(([category, revenue]) => ({
      category,
      revenue: Math.round(revenue * 100) / 100,
      percentage: 0, // Will be calculated on frontend
    }));

    // Calculate percentages
    const totalRevenue = result.reduce((sum, item) => sum + item.revenue, 0);
    result.forEach(item => {
      item.percentage = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100 * 100) / 100 : 0;
    });

    return successResponse(res, {
      categories: result.sort((a, b) => b.revenue - a.revenue),
      total_revenue: totalRevenue,
    });
  } catch (error) {
    logger.error('Get revenue by category error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get peak hours analysis
 */
async function getPeakHoursAnalysis(req, res) {
  try {
    const { date_from, date_to } = req.query;
    
    let query = supabase
      .from('bookings')
      .select('booking_time, booking_date, created_at')
      .in('status', ['confirmed', 'completed']);

    if (date_from) {
      query = query.gte('booking_date', date_from);
    }
    if (date_to) {
      query = query.lte('booking_date', date_to);
    }

    const { data: bookings, error } = await query;

    if (error) {
      logger.error('Get peak hours analysis error:', error);
      throw new Error('Failed to fetch bookings');
    }

    // Aggregate by hour
    const hourCounts = {};
    const dayHourCounts = {}; // For heatmap: day of week x hour

    (bookings || []).forEach(booking => {
      if (booking.booking_time) {
        const timeParts = booking.booking_time.split(':');
        const hour = parseInt(timeParts[0]) || 0;
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;

        // For heatmap
        if (booking.booking_date) {
          const date = new Date(booking.booking_date);
          const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
          const key = `${dayOfWeek}-${hour}`;
          dayHourCounts[key] = (dayHourCounts[key] || 0) + 1;
        }
      }
    });

    // Format for charts
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      hourLabel: `${hour.toString().padStart(2, '0')}:00`,
      count: hourCounts[hour] || 0,
    }));

    // Heatmap data (day x hour)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const heatmapData = days.map((day, dayIndex) => ({
      day,
      dayIndex,
      hours: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: dayHourCounts[`${dayIndex}-${hour}`] || 0,
      })),
    }));

    return successResponse(res, {
      hourly: hourlyData,
      heatmap: heatmapData,
      peak_hour: hourlyData.reduce((max, item) => item.count > max.count ? item : max, hourlyData[0]),
    });
  } catch (error) {
    logger.error('Get peak hours analysis error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get customer acquisition funnel
 */
async function getCustomerAcquisitionFunnel(req, res) {
  try {
    const { date_from, date_to } = req.query;

    // Get all users
    let userQuery = supabase.from('users').select('id, created_at');
    if (date_from) {
      userQuery = userQuery.gte('created_at', date_from);
    }
    if (date_to) {
      userQuery = userQuery.lte('created_at', date_to);
    }
    const { data: users } = await userQuery;

    // Get users with bookings
    let bookingQuery = supabase
      .from('bookings')
      .select('user_id, created_at')
      .order('created_at', { ascending: true });
    
    if (date_from) {
      bookingQuery = bookingQuery.gte('created_at', date_from);
    }
    if (date_to) {
      bookingQuery = bookingQuery.lte('created_at', date_to);
    }
    const { data: bookings } = await bookingQuery;

    // Calculate funnel metrics
    const totalUsers = users?.length || 0;
    const usersWithBookings = new Set(bookings?.map(b => b.user_id) || []);
    const usersWithFirstBooking = usersWithBookings.size;
    
    // Get repeat customers (users with 2+ bookings)
    const bookingCounts = {};
    bookings?.forEach(booking => {
      bookingCounts[booking.user_id] = (bookingCounts[booking.user_id] || 0) + 1;
    });
    const repeatCustomers = Object.values(bookingCounts).filter(count => count >= 2).length;

    // Calculate conversion rates
    const registrationToFirstBooking = totalUsers > 0 
      ? Math.round((usersWithFirstBooking / totalUsers) * 100 * 100) / 100 
      : 0;
    
    const firstToRepeat = usersWithFirstBooking > 0
      ? Math.round((repeatCustomers / usersWithFirstBooking) * 100 * 100) / 100
      : 0;

    return successResponse(res, {
      funnel: [
        { stage: 'Registered', count: totalUsers, percentage: 100 },
        { stage: 'First Booking', count: usersWithFirstBooking, percentage: registrationToFirstBooking },
        { stage: 'Repeat Customer', count: repeatCustomers, percentage: firstToRepeat },
      ],
      metrics: {
        total_users: totalUsers,
        users_with_bookings: usersWithFirstBooking,
        repeat_customers: repeatCustomers,
        conversion_rate: registrationToFirstBooking,
        retention_rate: firstToRepeat,
      },
    });
  } catch (error) {
    logger.error('Get customer acquisition funnel error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get partner performance comparison
 */
async function getPartnerPerformanceComparison(req, res) {
  try {
    const { limit = 10, date_from, date_to } = req.query;

    // Get all partners with their bookings
    let bookingQuery = supabase
      .from('bookings')
      .select('partner_id, status, grand_total, partner_payout, rating, created_at, service_started_at, assigned_at, accepted_at')
      .not('partner_id', 'is', null);

    if (date_from) {
      bookingQuery = bookingQuery.gte('created_at', date_from);
    }
    if (date_to) {
      bookingQuery = bookingQuery.lte('created_at', date_to);
    }

    const { data: bookings } = await bookingQuery;

    // Get partner details
    const { data: partners } = await supabase
      .from('partners')
      .select('id, name, partner_code, rating, total_bookings');

    // Aggregate partner performance
    const partnerStats = {};

    partners?.forEach(partner => {
      partnerStats[partner.id] = {
        partner_id: partner.id,
        name: partner.name,
        partner_code: partner.partner_code,
        total_bookings: 0,
        completed_bookings: 0,
        cancelled_bookings: 0,
        total_earnings: 0,
        average_rating: 0,
        completion_rate: 0,
        average_response_time: 0,
        ratings: [],
      };
    });

    // Calculate stats from bookings
    bookings?.forEach(booking => {
      if (booking.partner_id && partnerStats[booking.partner_id]) {
        const stats = partnerStats[booking.partner_id];
        stats.total_bookings++;
        
        if (booking.status === 'completed') {
          stats.completed_bookings++;
          stats.total_earnings += parseFloat(booking.partner_payout || 0);
        }
        if (booking.status === 'cancelled') {
          stats.cancelled_bookings++;
        }
        
        if (booking.rating) {
          stats.ratings.push(parseFloat(booking.rating));
        }

        // Calculate response time
        if (booking.assigned_at && booking.accepted_at) {
          const assigned = new Date(booking.assigned_at);
          const accepted = new Date(booking.accepted_at);
          const responseTime = (accepted - assigned) / (1000 * 60); // minutes
          if (!stats.response_times) stats.response_times = [];
          stats.response_times.push(responseTime);
        }
      }
    });

    // Calculate final metrics
    const leaderboard = Object.values(partnerStats)
      .map(stats => {
        stats.completion_rate = stats.total_bookings > 0
          ? Math.round((stats.completed_bookings / stats.total_bookings) * 100 * 100) / 100
          : 0;
        
        stats.average_rating = stats.ratings.length > 0
          ? Math.round((stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length) * 10) / 10
          : 0;
        
        stats.average_response_time = stats.response_times && stats.response_times.length > 0
          ? Math.round((stats.response_times.reduce((a, b) => a + b, 0) / stats.response_times.length) * 10) / 10
          : 0;

        // Calculate performance score (weighted)
        stats.performance_score = 
          (stats.completion_rate * 0.3) +
          (stats.average_rating * 10 * 0.3) +
          (Math.max(0, 100 - stats.average_response_time) * 0.2) +
          (Math.min(stats.total_bookings / 10, 1) * 100 * 0.2);

        delete stats.ratings;
        delete stats.response_times;
        return stats;
      })
      .filter(stats => stats.total_bookings > 0)
      .sort((a, b) => b.performance_score - a.performance_score)
      .slice(0, parseInt(limit));

    return successResponse(res, {
      leaderboard,
      total_partners: partners?.length || 0,
      active_partners: leaderboard.length,
    });
  } catch (error) {
    logger.error('Get partner performance comparison error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get geographic heatmap (demand by pincode/area)
 */
async function getGeographicHeatmap(req, res) {
  try {
    const { date_from, date_to } = req.query;

    let query = supabase
      .from('bookings')
      .select('user_addresses(*), grand_total, created_at')
      .in('status', ['confirmed', 'completed']);

    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    const { data: bookings, error } = await query;

    if (error) {
      logger.error('Get geographic heatmap error:', error);
      throw new Error('Failed to fetch bookings');
    }

    // Aggregate by pincode
    const pincodeData = {};
    const cityData = {};

    (bookings || []).forEach(booking => {
      let pincode = null;
      let city = null;

      // Extract from user_addresses (joined table)
      if (booking.user_addresses) {
        // user_addresses is an object (not array) when using foreign key join
        const address = booking.user_addresses;
        pincode = address?.pincode;
        city = address?.city;
      }

      if (pincode) {
        if (!pincodeData[pincode]) {
          pincodeData[pincode] = {
            pincode,
            bookings: 0,
            revenue: 0,
          };
        }
        pincodeData[pincode].bookings++;
        pincodeData[pincode].revenue += parseFloat(booking.grand_total || 0);
      }

      if (city) {
        if (!cityData[city]) {
          cityData[city] = {
            city,
            bookings: 0,
            revenue: 0,
          };
        }
        cityData[city].bookings++;
        cityData[city].revenue += parseFloat(booking.grand_total || 0);
      }
    });

    return successResponse(res, {
      by_pincode: Object.values(pincodeData).sort((a, b) => b.bookings - a.bookings),
      by_city: Object.values(cityData).sort((a, b) => b.bookings - a.bookings),
      total_areas: Object.keys(pincodeData).length,
    });
  } catch (error) {
    logger.error('Get geographic heatmap error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get cohort analysis (customer retention)
 */
async function getCohortAnalysis(req, res) {
  try {
    const { cohort_period = 'month' } = req.query; // 'week' or 'month'

    // Get all users with their first booking date
    const { data: users } = await supabase
      .from('users')
      .select('id, created_at');

    // Get all bookings grouped by user
    const { data: bookings } = await supabase
      .from('bookings')
      .select('user_id, created_at, booking_date')
      .order('created_at', { ascending: true });

    // Group users by cohort (registration period)
    const cohorts = {};
    const userFirstBooking = {};

    users?.forEach(user => {
      const userDate = new Date(user.created_at);
      let cohortKey;
      
      if (cohort_period === 'week') {
        const weekStart = new Date(userDate);
        weekStart.setDate(userDate.getDate() - userDate.getDay());
        cohortKey = weekStart.toISOString().split('T')[0];
      } else {
        cohortKey = `${userDate.getFullYear()}-${String(userDate.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!cohorts[cohortKey]) {
        cohorts[cohortKey] = {
          cohort: cohortKey,
          total_users: 0,
          users: new Set(),
        };
      }
      cohorts[cohortKey].total_users++;
      cohorts[cohortKey].users.add(user.id);
    });

    // Track first booking for each user
    bookings?.forEach(booking => {
      if (!userFirstBooking[booking.user_id]) {
        userFirstBooking[booking.user_id] = booking.created_at;
      }
    });

    // Calculate retention by period
    const cohortData = Object.values(cohorts).map(cohort => {
      const cohortDate = new Date(cohort.cohort);
      const periods = [];
      
      // Calculate retention for each period (0, 1, 2, 3... months/weeks later)
      for (let period = 0; period < 12; period++) {
        const periodDate = new Date(cohortDate);
        if (cohort_period === 'week') {
          periodDate.setDate(periodDate.getDate() + (period * 7));
        } else {
          periodDate.setMonth(periodDate.getMonth() + period);
        }

        // Count users who made bookings in this period
        let activeUsers = 0;
        cohort.users.forEach(userId => {
          const firstBooking = userFirstBooking[userId];
          if (firstBooking) {
            const bookingDate = new Date(firstBooking);
            const periodStart = new Date(periodDate);
            const periodEnd = new Date(periodDate);
            if (cohort_period === 'week') {
              periodEnd.setDate(periodEnd.getDate() + 7);
            } else {
              periodEnd.setMonth(periodEnd.getMonth() + 1);
            }

            if (bookingDate >= periodStart && bookingDate < periodEnd) {
              activeUsers++;
            }
          }
        });

        const retentionRate = cohort.total_users > 0
          ? Math.round((activeUsers / cohort.total_users) * 100 * 100) / 100
          : 0;

        periods.push({
          period,
          active_users: activeUsers,
          retention_rate: retentionRate,
        });
      }

      return {
        cohort: cohort.cohort,
        total_users: cohort.total_users,
        periods,
      };
    });

    return successResponse(res, {
      cohorts: cohortData.sort((a, b) => a.cohort.localeCompare(b.cohort)),
      period_type: cohort_period,
    });
  } catch (error) {
    logger.error('Get cohort analysis error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get service popularity
 */
async function getServicePopularity(req, res) {
  try {
    const { date_from, date_to, limit = 20 } = req.query;

    let query = supabase
      .from('bookings')
      .select('services, created_at')
      .in('status', ['confirmed', 'completed']);

    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    const { data: bookings, error } = await query;

    if (error) {
      logger.error('Get service popularity error:', error);
      throw new Error('Failed to fetch bookings');
    }

    // Aggregate service popularity
    const serviceStats = {};

    (bookings || []).forEach(booking => {
      const items = Array.isArray(booking.services) ? booking.services : [];
      items.forEach(item => {
        const serviceName = item.service_name || item.name || 'Unknown Service';
        const serviceId = item.service_id || item.id;
        
        if (!serviceStats[serviceName]) {
          serviceStats[serviceName] = {
            service_name: serviceName,
            service_id: serviceId,
            bookings: 0,
            quantity: 0,
            revenue: 0,
          };
        }
        
        serviceStats[serviceName].bookings++;
        serviceStats[serviceName].quantity += (item.quantity || 1);
        serviceStats[serviceName].revenue += parseFloat(item.price || 0) * (item.quantity || 1);
      });
    });

    // Convert to array and sort
    const popular = Object.values(serviceStats)
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, parseInt(limit));

    const leastPopular = Object.values(serviceStats)
      .sort((a, b) => a.bookings - b.bookings)
      .slice(0, parseInt(limit));

    return successResponse(res, {
      most_popular: popular,
      least_popular: leastPopular,
      total_services: Object.keys(serviceStats).length,
    });
  } catch (error) {
    logger.error('Get service popularity error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get Average Order Value (AOV) trends
 */
async function getAOVTrends(req, res) {
  try {
    const { date_from, date_to, period = 'day' } = req.query; // 'day', 'week', 'month'

    let query = supabase
      .from('bookings')
      .select('grand_total, created_at, booking_date')
      .eq('status', 'completed')
      .eq('payment_status', 'paid');

    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    const { data: bookings, error } = await query;

    if (error) {
      logger.error('Get AOV trends error:', error);
      throw new Error('Failed to fetch bookings');
    }

    // Group by period
    const periodData = {};

    (bookings || []).forEach(booking => {
      const date = new Date(booking.booking_date || booking.created_at);
      let periodKey;

      if (period === 'day') {
        periodKey = date.toISOString().split('T')[0];
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
      } else {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!periodData[periodKey]) {
        periodData[periodKey] = {
          period: periodKey,
          total_revenue: 0,
          booking_count: 0,
          aov: 0,
        };
      }

      periodData[periodKey].total_revenue += parseFloat(booking.grand_total || 0);
      periodData[periodKey].booking_count++;
    });

    // Calculate AOV for each period
    const trends = Object.values(periodData)
      .map(data => {
        data.aov = data.booking_count > 0
          ? Math.round((data.total_revenue / data.booking_count) * 100) / 100
          : 0;
        return data;
      })
      .sort((a, b) => a.period.localeCompare(b.period));

    // Calculate overall AOV
    const totalRevenue = trends.reduce((sum, item) => sum + item.total_revenue, 0);
    const totalBookings = trends.reduce((sum, item) => sum + item.booking_count, 0);
    const overallAOV = totalBookings > 0 ? Math.round((totalRevenue / totalBookings) * 100) / 100 : 0;

    return successResponse(res, {
      trends,
      overall_aov: overallAOV,
      period_type: period,
      total_revenue: totalRevenue,
      total_bookings: totalBookings,
    });
  } catch (error) {
    logger.error('Get AOV trends error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get comprehensive analytics dashboard data
 */
async function getAnalyticsDashboard(req, res) {
  try {
    const { date_from, date_to } = req.query;

    // Call internal functions directly
    const revenueByCategory = await getRevenueByCategoryInternal(date_from, date_to);
    const peakHours = await getPeakHoursAnalysisInternal(date_from, date_to);
    const customerFunnel = await getCustomerAcquisitionFunnelInternal(date_from, date_to);
    const partnerPerformance = await getPartnerPerformanceComparisonInternal(5, date_from, date_to);
    const geographicData = await getGeographicHeatmapInternal(date_from, date_to);
    const servicePopularity = await getServicePopularityInternal(10, date_from, date_to);
    const aovTrends = await getAOVTrendsInternal(date_from, date_to, 'day');

    return successResponse(res, {
      revenue_by_category: revenueByCategory,
      peak_hours: peakHours,
      customer_funnel: customerFunnel,
      partner_performance: partnerPerformance,
      geographic: geographicData,
      service_popularity: servicePopularity,
      aov_trends: aovTrends,
    });
  } catch (error) {
    logger.error('Get analytics dashboard error:', error);
    return errorResponse(res, error, 500);
  }
}

// Internal helper functions (extracted logic)
async function getRevenueByCategoryInternal(date_from, date_to) {
  let query = supabase
    .from('bookings')
    .select('services, grand_total, created_at')
    .eq('status', 'completed')
    .eq('payment_status', 'paid');

  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to);

  const { data: bookings } = await query;
  const categoryRevenue = {};
  
  (bookings || []).forEach(booking => {
    const items = Array.isArray(booking.services) ? booking.services : [];
    items.forEach(item => {
      const category = item.service_category || item.category || 'Other';
      const revenue = parseFloat(item.price || 0) * (item.quantity || 1);
      categoryRevenue[category] = (categoryRevenue[category] || 0) + revenue;
    });
  });

  const result = Object.entries(categoryRevenue).map(([category, revenue]) => ({
    category,
    revenue: Math.round(revenue * 100) / 100,
  }));

  const totalRevenue = result.reduce((sum, item) => sum + item.revenue, 0);
  result.forEach(item => {
    item.percentage = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100 * 100) / 100 : 0;
  });

  return { categories: result.sort((a, b) => b.revenue - a.revenue), total_revenue: totalRevenue };
}

async function getPeakHoursAnalysisInternal(date_from, date_to) {
  let query = supabase
    .from('bookings')
    .select('booking_time, booking_date, created_at')
    .in('status', ['confirmed', 'completed']);

  if (date_from) query = query.gte('booking_date', date_from);
  if (date_to) query = query.lte('booking_date', date_to);

  const { data: bookings } = await query;
  const hourCounts = {};
  const dayHourCounts = {};

  (bookings || []).forEach(booking => {
    if (booking.booking_time) {
      const hour = parseInt(booking.booking_time.split(':')[0]) || 0;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      if (booking.booking_date) {
        const date = new Date(booking.booking_date);
        const dayOfWeek = date.getDay();
        const key = `${dayOfWeek}-${hour}`;
        dayHourCounts[key] = (dayHourCounts[key] || 0) + 1;
      }
    }
  });

  const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    hourLabel: `${hour.toString().padStart(2, '0')}:00`,
    count: hourCounts[hour] || 0,
  }));

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const heatmapData = days.map((day, dayIndex) => ({
    day,
    dayIndex,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: dayHourCounts[`${dayIndex}-${hour}`] || 0,
    })),
  }));

  return {
    hourly: hourlyData,
    heatmap: heatmapData,
    peak_hour: hourlyData.reduce((max, item) => item.count > max.count ? item : max, hourlyData[0]),
  };
}

async function getCustomerAcquisitionFunnelInternal(date_from, date_to) {
  let userQuery = supabase.from('users').select('id, created_at');
  if (date_from) userQuery = userQuery.gte('created_at', date_from);
  if (date_to) userQuery = userQuery.lte('created_at', date_to);
  const { data: users } = await userQuery;

  let bookingQuery = supabase.from('bookings').select('user_id, created_at').order('created_at', { ascending: true });
  if (date_from) bookingQuery = bookingQuery.gte('created_at', date_from);
  if (date_to) bookingQuery = bookingQuery.lte('created_at', date_to);
  const { data: bookings } = await bookingQuery;

  const totalUsers = users?.length || 0;
  const usersWithBookings = new Set(bookings?.map(b => b.user_id) || []);
  const usersWithFirstBooking = usersWithBookings.size;
  
  const bookingCounts = {};
  bookings?.forEach(booking => {
    bookingCounts[booking.user_id] = (bookingCounts[booking.user_id] || 0) + 1;
  });
  const repeatCustomers = Object.values(bookingCounts).filter(count => count >= 2).length;

  const registrationToFirstBooking = totalUsers > 0 
    ? Math.round((usersWithFirstBooking / totalUsers) * 100 * 100) / 100 
    : 0;
  
  const firstToRepeat = usersWithFirstBooking > 0
    ? Math.round((repeatCustomers / usersWithFirstBooking) * 100 * 100) / 100
    : 0;

  return {
    funnel: [
      { stage: 'Registered', count: totalUsers, percentage: 100 },
      { stage: 'First Booking', count: usersWithFirstBooking, percentage: registrationToFirstBooking },
      { stage: 'Repeat Customer', count: repeatCustomers, percentage: firstToRepeat },
    ],
    metrics: {
      total_users: totalUsers,
      users_with_bookings: usersWithFirstBooking,
      repeat_customers: repeatCustomers,
      conversion_rate: registrationToFirstBooking,
      retention_rate: firstToRepeat,
    },
  };
}

async function getPartnerPerformanceComparisonInternal(limit, date_from, date_to) {
  let bookingQuery = supabase
    .from('bookings')
    .select('partner_id, status, grand_total, partner_payout, rating, created_at, service_started_at, assigned_at, accepted_at')
    .not('partner_id', 'is', null);

  if (date_from) bookingQuery = bookingQuery.gte('created_at', date_from);
  if (date_to) bookingQuery = bookingQuery.lte('created_at', date_to);

  const { data: bookings } = await bookingQuery;
  const { data: partners } = await supabase.from('partners').select('id, name, partner_code, rating, total_bookings');

  const partnerStats = {};
  partners?.forEach(partner => {
    partnerStats[partner.id] = {
      partner_id: partner.id,
      name: partner.name,
      partner_code: partner.partner_code,
      total_bookings: 0,
      completed_bookings: 0,
      cancelled_bookings: 0,
      total_earnings: 0,
      average_rating: 0,
      completion_rate: 0,
      average_response_time: 0,
      ratings: [],
    };
  });

  bookings?.forEach(booking => {
    if (booking.partner_id && partnerStats[booking.partner_id]) {
      const stats = partnerStats[booking.partner_id];
      stats.total_bookings++;
      if (booking.status === 'completed') {
        stats.completed_bookings++;
        stats.total_earnings += parseFloat(booking.partner_payout || 0);
      }
      if (booking.status === 'cancelled') stats.cancelled_bookings++;
      if (booking.rating) stats.ratings.push(parseFloat(booking.rating));
      if (booking.assigned_at && booking.accepted_at) {
        const assigned = new Date(booking.assigned_at);
        const accepted = new Date(booking.accepted_at);
        const responseTime = (accepted - assigned) / (1000 * 60);
        if (!stats.response_times) stats.response_times = [];
        stats.response_times.push(responseTime);
      }
    }
  });

  const leaderboard = Object.values(partnerStats)
    .map(stats => {
      stats.completion_rate = stats.total_bookings > 0
        ? Math.round((stats.completed_bookings / stats.total_bookings) * 100 * 100) / 100
        : 0;
      stats.average_rating = stats.ratings.length > 0
        ? Math.round((stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length) * 10) / 10
        : 0;
      stats.average_response_time = stats.response_times && stats.response_times.length > 0
        ? Math.round((stats.response_times.reduce((a, b) => a + b, 0) / stats.response_times.length) * 10) / 10
        : 0;
      stats.performance_score = 
        (stats.completion_rate * 0.3) +
        (stats.average_rating * 10 * 0.3) +
        (Math.max(0, 100 - stats.average_response_time) * 0.2) +
        (Math.min(stats.total_bookings / 10, 1) * 100 * 0.2);
      delete stats.ratings;
      delete stats.response_times;
      return stats;
    })
    .filter(stats => stats.total_bookings > 0)
    .sort((a, b) => b.performance_score - a.performance_score)
    .slice(0, parseInt(limit));

  return { leaderboard, total_partners: partners?.length || 0, active_partners: leaderboard.length };
}

async function getGeographicHeatmapInternal(date_from, date_to) {
  let query = supabase
    .from('bookings')
    .select('user_addresses(*), grand_total, created_at')
    .in('status', ['confirmed', 'completed']);

  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to);

  const { data: bookings } = await query;
  const pincodeData = {};
  const cityData = {};

  (bookings || []).forEach(booking => {
    let pincode = null;
    let city = null;

    // Extract from user_addresses (joined table - object, not array)
    if (booking.user_addresses) {
      const address = booking.user_addresses;
      pincode = address?.pincode;
      city = address?.city;
    }

    if (pincode) {
      if (!pincodeData[pincode]) {
        pincodeData[pincode] = { pincode, bookings: 0, revenue: 0 };
      }
      pincodeData[pincode].bookings++;
      pincodeData[pincode].revenue += parseFloat(booking.grand_total || 0);
    }

    if (city) {
      if (!cityData[city]) {
        cityData[city] = { city, bookings: 0, revenue: 0 };
      }
      cityData[city].bookings++;
      cityData[city].revenue += parseFloat(booking.grand_total || 0);
    }
  });

  return {
    by_pincode: Object.values(pincodeData).sort((a, b) => b.bookings - a.bookings),
    by_city: Object.values(cityData).sort((a, b) => b.bookings - a.bookings),
    total_areas: Object.keys(pincodeData).length,
  };
}

async function getServicePopularityInternal(limit, date_from, date_to) {
  let query = supabase
    .from('bookings')
    .select('services, created_at')
    .in('status', ['confirmed', 'completed']);

  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to);

  const { data: bookings } = await query;
  const serviceStats = {};

  (bookings || []).forEach(booking => {
    const items = Array.isArray(booking.services) ? booking.services : [];
    items.forEach(item => {
      const serviceName = item.service_name || item.name || 'Unknown Service';
      const serviceId = item.service_id || item.id;
      
      if (!serviceStats[serviceName]) {
        serviceStats[serviceName] = {
          service_name: serviceName,
          service_id: serviceId,
          bookings: 0,
          quantity: 0,
          revenue: 0,
        };
      }
      
      serviceStats[serviceName].bookings++;
      serviceStats[serviceName].quantity += (item.quantity || 1);
      serviceStats[serviceName].revenue += parseFloat(item.price || 0) * (item.quantity || 1);
    });
  });

  const popular = Object.values(serviceStats)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, parseInt(limit));

  const leastPopular = Object.values(serviceStats)
    .sort((a, b) => a.bookings - b.bookings)
    .slice(0, parseInt(limit));

  return {
    most_popular: popular,
    least_popular: leastPopular,
    total_services: Object.keys(serviceStats).length,
  };
}

async function getAOVTrendsInternal(date_from, date_to, period) {
  let query = supabase
    .from('bookings')
    .select('grand_total, created_at, booking_date')
    .eq('status', 'completed')
    .eq('payment_status', 'paid');

  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to);

  const { data: bookings } = await query;
  const periodData = {};

  (bookings || []).forEach(booking => {
    const date = new Date(booking.booking_date || booking.created_at);
    let periodKey;

    if (period === 'day') {
      periodKey = date.toISOString().split('T')[0];
    } else if (period === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      periodKey = weekStart.toISOString().split('T')[0];
    } else {
      periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!periodData[periodKey]) {
      periodData[periodKey] = { period: periodKey, total_revenue: 0, booking_count: 0, aov: 0 };
    }

    periodData[periodKey].total_revenue += parseFloat(booking.grand_total || 0);
    periodData[periodKey].booking_count++;
  });

  const trends = Object.values(periodData)
    .map(data => {
      data.aov = data.booking_count > 0
        ? Math.round((data.total_revenue / data.booking_count) * 100) / 100
        : 0;
      return data;
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  const totalRevenue = trends.reduce((sum, item) => sum + item.total_revenue, 0);
  const totalBookings = trends.reduce((sum, item) => sum + item.booking_count, 0);
  const overallAOV = totalBookings > 0 ? Math.round((totalRevenue / totalBookings) * 100) / 100 : 0;

  return {
    trends,
    overall_aov: overallAOV,
    period_type: period,
    total_revenue: totalRevenue,
    total_bookings: totalBookings,
  };
}

module.exports = {
  getRevenueByCategory,
  getPeakHoursAnalysis,
  getCustomerAcquisitionFunnel,
  getPartnerPerformanceComparison,
  getGeographicHeatmap,
  getCohortAnalysis,
  getServicePopularity,
  getAOVTrends,
  getAnalyticsDashboard,
};

