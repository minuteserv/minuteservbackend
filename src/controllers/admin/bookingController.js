const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');
const pointsService = require('../../services/pointsService');
const { processRefund: processRazorpayRefund } = require('../../services/razorpayService');

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

/**
 * Duplicate booking
 */
async function duplicateBooking(req, res) {
  try {
    const { id } = req.params;

    // Get original booking
    const { data: originalBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !originalBooking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Create new booking with same data but new dates
    const newBooking = {
      ...originalBooking,
      id: undefined, // Let Supabase generate new ID
      booking_number: undefined, // Will be auto-generated
      status: 'pending',
      payment_status: 'pending',
      partner_id: null,
      assignment_status: null,
      assigned_at: null,
      created_at: undefined,
      updated_at: undefined,
    };

    delete newBooking.id;
    delete newBooking.booking_number;
    delete newBooking.created_at;
    delete newBooking.updated_at;

    const { data: duplicatedBooking, error: createError } = await supabase
      .from('bookings')
      .insert(newBooking)
      .select()
      .single();

    if (createError) {
      logger.error('Duplicate booking error:', createError);
      throw new Error('Failed to duplicate booking');
    }

    logger.info(`Booking ${id} duplicated as ${duplicatedBooking.id}`);
    return successResponse(res, duplicatedBooking, 'Booking duplicated successfully');
  } catch (error) {
    logger.error('Duplicate booking error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get booking timeline (status history)
 */
async function getBookingTimeline(req, res) {
  try {
    const { id } = req.params;

    // For now, we'll create timeline from booking's updated_at and status changes
    // In future, you can create a separate booking_history table
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (!booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Create timeline entries
    const timeline = [
      {
        id: '1',
        action: 'created',
        status: 'pending',
        description: 'Booking created',
        timestamp: booking.created_at,
        user: 'System',
      },
    ];

    if (booking.updated_at && booking.updated_at !== booking.created_at) {
      timeline.push({
        id: '2',
        action: 'updated',
        status: booking.status,
        description: `Status changed to ${booking.status}`,
        timestamp: booking.updated_at,
        user: 'Admin',
      });
    }

    if (booking.assigned_at) {
      timeline.push({
        id: '3',
        action: 'assigned',
        status: booking.status,
        description: 'Partner assigned',
        timestamp: booking.assigned_at,
        user: 'Admin',
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return successResponse(res, timeline);
  } catch (error) {
    logger.error('Get booking timeline error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Add booking note
 */
async function addBookingNote(req, res) {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return errorResponse(res, { message: 'Note is required' }, 400);
    }

    // Get current booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Append note to existing notes (handle if column doesn't exist)
    const existingNotes = booking.admin_notes || [];
    const newNote = {
      note: note.trim(),
      added_at: new Date().toISOString(),
      added_by: 'Admin',
    };

    const updatedNotes = [...existingNotes, newNote];

    // Try to update with admin_notes, if column doesn't exist, just update updated_at
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    // Only add admin_notes if we can (column might not exist yet)
    try {
      updateData.admin_notes = updatedNotes;
    } catch (e) {
      logger.warn('admin_notes column may not exist, storing note in metadata');
    }

    const { data: updatedBooking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // If admin_notes column doesn't exist, try without it
      if (error.message && error.message.includes('admin_notes')) {
        const { data: fallbackBooking, error: fallbackError } = await supabase
          .from('bookings')
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (fallbackError) {
          logger.error('Add booking note error:', fallbackError);
          throw new Error('Failed to add note');
        }

        logger.warn('Note saved but admin_notes column not available. Please add column to bookings table.');
        return successResponse(res, fallbackBooking, 'Note logged (admin_notes column needs to be added to database)');
      }
      logger.error('Add booking note error:', error);
      throw new Error('Failed to add note');
    }

    return successResponse(res, updatedBooking, 'Note added successfully');
  } catch (error) {
    logger.error('Add booking note error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Bulk update booking status
 */
async function bulkUpdateStatus(req, res) {
  try {
    const { booking_ids, status } = req.body;

    if (!Array.isArray(booking_ids) || booking_ids.length === 0) {
      return errorResponse(res, { message: 'Booking IDs array is required' }, 400);
    }

    if (!status) {
      return errorResponse(res, { message: 'Status is required' }, 400);
    }

    const { data: updatedBookings, error } = await supabase
      .from('bookings')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .in('id', booking_ids)
      .select();

    if (error) {
      logger.error('Bulk update status error:', error);
      throw new Error('Failed to update bookings');
    }

    logger.info(`Bulk updated ${updatedBookings.length} bookings to status: ${status}`);
    return successResponse(res, {
      updated_count: updatedBookings.length,
      bookings: updatedBookings,
    }, `${updatedBookings.length} bookings updated successfully`);
  } catch (error) {
    logger.error('Bulk update status error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Generate invoice data for printing
 */
async function getBookingInvoice(req, res) {
  try {
    const { id } = req.params;

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, users(*), partners(*)')
      .eq('id', id)
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

    // Format invoice data
    const invoice = {
      invoice_number: `INV-${booking.booking_number}`,
      booking_number: booking.booking_number,
      date: booking.booking_date,
      time: booking.booking_time,
      customer: {
        name: booking.users?.name || booking.customer_name || 'N/A',
        phone: booking.users?.phone_number || booking.customer_phone || 'N/A',
        email: booking.users?.email || booking.customer_email || 'N/A',
        address: booking.delivery_address || 'N/A',
      },
      partner: booking.partners ? {
        name: booking.partners.name,
        code: booking.partners.partner_code,
      } : null,
      items: booking.booking_items || [],
      subtotal: booking.subtotal || 0,
      tax: booking.tax || 0,
      discount: booking.discount || 0,
      grand_total: booking.grand_total || 0,
      payment: payment ? {
        method: payment.payment_method || 'Online',
        transaction_id: payment.transaction_id || payment.id,
        status: payment.status,
      } : null,
      status: booking.status,
      created_at: booking.created_at,
    };

    return successResponse(res, invoice);
  } catch (error) {
    logger.error('Get booking invoice error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Process refund for booking (Admin)
 */
async function processBookingRefund(req, res) {
  try {
    const { id } = req.params;
    const { amount, reason, refund_type = 'full' } = req.body;

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, users(*), partners(*)')
      .eq('id', id)
      .single();

    if (bookingError || !booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Check if booking is eligible for refund
    if (booking.payment_status !== 'paid') {
      return errorResponse(res, { 
        message: `Booking payment status is '${booking.payment_status}'. Only paid bookings can be refunded.` 
      }, 400);
    }

    if (booking.status === 'cancelled' && booking.refund_amount) {
      return errorResponse(res, { 
        message: 'Refund already processed for this booking' 
      }, 400);
    }

    // Calculate refund amount
    let refundAmount = 0;
    if (refund_type === 'full') {
      refundAmount = parseFloat(booking.grand_total || 0);
    } else if (refund_type === 'partial' && amount) {
      refundAmount = parseFloat(amount);
      if (refundAmount > booking.grand_total) {
        return errorResponse(res, { 
          message: 'Refund amount cannot exceed booking total' 
        }, 400);
      }
    } else {
      return errorResponse(res, { 
        message: 'Invalid refund type or amount' 
      }, 400);
    }

    if (refundAmount <= 0) {
      return errorResponse(res, { 
        message: 'Refund amount must be greater than 0' 
      }, 400);
    }

    // Get payment record
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', id)
      .single();

    let razorpayRefundId = null;
    let refundStatus = 'pending';

    // Process Razorpay refund if online payment
    if (booking.payment_method === 'online' && payment?.razorpay_payment_id) {
      try {
        const refundResult = await processRazorpayRefund(
          payment.razorpay_payment_id,
          refundAmount,
          {
            reason: reason || 'Admin refund',
            booking_id: id,
            booking_number: booking.booking_number,
          }
        );

        razorpayRefundId = refundResult.refund_id;
        refundStatus = refundResult.status === 'processed' ? 'processed' : 'pending';
        
        logger.info(`Razorpay refund processed: ${razorpayRefundId} for booking ${booking.booking_number}`);
      } catch (razorpayError) {
        logger.error('Razorpay refund error:', razorpayError);
        // For cash payments or if Razorpay fails, we still record the refund
        // but mark it as pending manual processing
        refundStatus = 'pending_manual';
      }
    } else {
      // Cash payment - manual refund (no Razorpay)
      refundStatus = 'pending_manual';
    }

    // Update booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        refund_amount: refundAmount,
        cancellation_reason: reason || 'Refund processed by admin',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Update booking refund error:', updateError);
      throw new Error('Failed to update booking');
    }

    // Update payment status
    if (payment) {
      await supabase
        .from('payments')
        .update({
          status: 'refunded',
          refund_amount: refundAmount,
          refund_id: razorpayRefundId,
          refund_reason: reason || 'Admin refund',
          refunded_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
    }

    // Refund loyalty points if any were used
    if (booking.points_used && booking.points_used > 0) {
      try {
        await pointsService.awardPoints(
          booking.user_id,
          booking.points_used,
          'refund',
          booking.id,
          `Points refunded for booking ${booking.booking_number} refund`
        );
        logger.info(`Refunded ${booking.points_used} points to user ${booking.user_id}`);
      } catch (pointsError) {
        logger.error('Failed to refund points:', pointsError);
        // Don't fail the refund if points refund fails
      }
    }

    logger.info(`Refund processed for booking ${booking.booking_number}: ₹${refundAmount}`);

    return successResponse(res, {
      booking: updatedBooking,
      refund: {
        amount: refundAmount,
        status: refundStatus,
        razorpay_refund_id: razorpayRefundId,
        reason: reason || 'Admin refund',
        type: refund_type,
      },
    }, 'Refund processed successfully');
  } catch (error) {
    logger.error('Process booking refund error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminBookings,
  getAdminBookingById,
  updateBookingStatus,
  assignPartner,
  duplicateBooking,
  getBookingTimeline,
  addBookingNote,
  bulkUpdateStatus,
  getBookingInvoice,
  processBookingRefund,
};

