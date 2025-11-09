const supabase = require('../config/supabase');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get user bookings
 */
async function getUserBookings(req, res) {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Include address data in the query
    let query = supabase
      .from('bookings')
      .select('*, user_addresses(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    query = query.range(from, to);

    const { data: bookings, error, count } = await query;

    if (error) {
      logger.error('Get bookings error:', error);
      throw new Error('Failed to fetch bookings');
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return paginatedResponse(res, bookings || [], {
      page: pageNum,
      limit: limitNum,
      total: totalCount || 0,
      total_pages: Math.ceil((totalCount || 0) / limitNum)
    });
  } catch (error) {
    logger.error('Get user bookings error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get booking by ID
 */
async function getBookingById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, user_addresses(*), partners(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Get payment info
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
    logger.error('Get booking by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Cancel booking
 */
async function cancelBooking(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (bookingError || !booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      return errorResponse(res, { message: 'Booking already cancelled' }, 400);
    }

    if (booking.status === 'completed') {
      return errorResponse(res, { message: 'Cannot cancel completed booking' }, 400);
    }

    // Calculate refund (free cancellation within 5 minutes or if not assigned)
    const bookingTime = new Date(booking.created_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isFreeCancellation = bookingTime > fiveMinutesAgo || !booking.partner_id;

    let refundAmount = 0;
    let cancellationFee = 0;

    if (isFreeCancellation) {
      refundAmount = booking.grand_total;
    } else {
      cancellationFee = Math.floor(booking.grand_total * 0.10); // 10% cancellation fee
      refundAmount = booking.grand_total - cancellationFee;
    }

    // Update booking (updated_at is handled by trigger)
    // Note: cancellation_fee is not stored in DB, only refund_amount
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Cancelled by customer',
        refund_amount: refundAmount
        // updated_at is automatically updated by trigger
        // cancellation_fee is calculated but not stored (can be derived from grand_total - refund_amount)
      })
      .eq('id', id)
      .eq('user_id', userId) // Ensure user owns the booking
      .select()
      .single();

    if (updateError) {
      logger.error('Cancel booking update error:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
        fullError: updateError
      });
      return errorResponse(res, { 
        message: 'Failed to cancel booking',
        details: updateError.message || 'Database update failed'
      }, 500);
    }

    if (!updatedBooking) {
      logger.error('Cancel booking: No booking returned after update');
      return errorResponse(res, { message: 'Failed to cancel booking: No booking found after update' }, 500);
    }

    // If online payment, process refund
    if (booking.payment_method === 'online' && booking.payment_status === 'paid' && refundAmount > 0) {
      // TODO: Process refund via Razorpay
      // Update payment status
      await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('booking_id', id);
    }

    return successResponse(res, {
      booking: updatedBooking,
      refund_amount: refundAmount,
      cancellation_fee: cancellationFee
    }, 'Booking cancelled successfully');
  } catch (error) {
    logger.error('Cancel booking error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Rate booking
 */
async function rateBooking(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return errorResponse(res, { message: 'Rating must be between 1 and 5' }, 400);
    }

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .single();

    if (bookingError || !booking) {
      return errorResponse(res, { message: 'Completed booking not found' }, 404);
    }

    // Update booking with rating
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        customer_rating: rating,
        customer_feedback: feedback || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Rate booking error:', updateError);
      throw new Error('Failed to rate booking');
    }

    // Update partner rating if partner assigned
    if (booking.partner_id) {
      // Calculate new average rating
      const { data: partnerBookings } = await supabase
        .from('bookings')
        .select('customer_rating')
        .eq('partner_id', booking.partner_id)
        .not('customer_rating', 'is', null);

      if (partnerBookings && partnerBookings.length > 0) {
        const totalRating = partnerBookings.reduce((sum, b) => sum + (b.customer_rating || 0), 0);
        const avgRating = totalRating / partnerBookings.length;

        await supabase
          .from('partners')
          .update({ rating: Math.round(avgRating * 100) / 100 })
          .eq('id', booking.partner_id);
      }
    }

    return successResponse(res, updatedBooking, 'Rating submitted successfully');
  } catch (error) {
    logger.error('Rate booking error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getUserBookings,
  getBookingById,
  cancelBooking,
  rateBooking
};

