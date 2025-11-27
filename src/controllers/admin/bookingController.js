const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');
const pointsService = require('../../services/pointsService');

/**
 * Get all bookings (admin)
 */
async function getAdminBookings(req, res) {
  try {
    const { status, date_from, date_to, partner_id, user_id } = req.query;

    let query = supabase
      .from('bookings')
      .select('*, users(id, phone_number, name), partners(id, name, partner_code)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (date_from) query = query.gte('booking_date', date_from);
    if (date_to) query = query.lte('booking_date', date_to);
    if (partner_id) query = query.eq('partner_id', partner_id);
    if (user_id) query = query.eq('user_id', user_id);

    const { data: bookings, error } = await query.limit(100);

    if (error) {
      logger.error('Get admin bookings error:', error);
      throw new Error('Failed to fetch bookings');
    }

    return successResponse(res, bookings || []);
  } catch (error) {
    logger.error('Get admin bookings error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get booking by ID (admin)
 */
async function getAdminBookingById(req, res) {
  try {
    const { id } = req.params;

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, users(*), partners(*), user_addresses(*)')
      .eq('id', id)
      .single();

    if (error || !booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Get payment
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', id)
      .single();

    return successResponse(res, {
      booking,
      payment: payment || null
    });
  } catch (error) {
    logger.error('Get admin booking by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update booking status
 */
async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return errorResponse(res, { message: 'Status is required' }, 400);
    }

    // Get current booking to check if status is changing to 'completed'
    const { data: currentBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    const { data: booking, error } = await supabase
      .from('bookings')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update booking status error:', error);
      throw new Error('Failed to update booking status');
    }

    // Award points when booking is completed
    if (status === 'completed' && currentBooking?.status !== 'completed') {
      try {
        const pointsToAward = pointsService.calculatePointsForBooking(booking.grand_total);
        await pointsService.awardPoints(
          booking.user_id,
          pointsToAward,
          'booking',
          booking.id,
          `Points earned for booking #${booking.booking_number}`
        );
        logger.info(`Awarded ${pointsToAward} points to user ${booking.user_id} for booking ${booking.booking_number}`);
      } catch (pointsError) {
        // Log error but don't fail the booking status update
        logger.error('Failed to award points:', pointsError);
      }
    }

    return successResponse(res, booking, 'Booking status updated');
  } catch (error) {
    logger.error('Update booking status error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Assign partner to booking
 */
async function assignPartner(req, res) {
  try {
    const { id } = req.params;
    const { partner_id } = req.body;

    if (!partner_id) {
      return errorResponse(res, { message: 'Partner ID is required' }, 400);
    }

    // Verify partner exists
    const { data: partner } = await supabase
      .from('partners')
      .select('*')
      .eq('id', partner_id)
      .eq('is_active', true)
      .single();

    if (!partner) {
      return errorResponse(res, { message: 'Partner not found or inactive' }, 404);
    }

    // Update booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .update({
        partner_id,
        assignment_status: 'assigned',
        assigned_at: new Date().toISOString(),
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Assign partner error:', error);
      throw new Error('Failed to assign partner');
    }

    return successResponse(res, {
      booking,
      partner
    }, 'Partner assigned successfully');
  } catch (error) {
    logger.error('Assign partner error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminBookings,
  getAdminBookingById,
  updateBookingStatus,
  assignPartner
};

