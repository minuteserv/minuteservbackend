const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

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

    // Parse services JSONB field if it's a string
    const processedBookings = (bookings || []).map(booking => {
      if (booking.services) {
        if (typeof booking.services === 'string') {
          try {
            booking.services = JSON.parse(booking.services);
          } catch (e) {
            logger.error('Error parsing services JSON:', e);
            booking.services = [];
          }
        }
        // Ensure services is an array
        if (!Array.isArray(booking.services)) {
          booking.services = [];
        }
      } else {
        booking.services = [];
      }
      return booking;
    });

    return successResponse(res, processedBookings);
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

    // Parse services JSONB field if it's a string
    if (booking.services) {
      if (typeof booking.services === 'string') {
        try {
          booking.services = JSON.parse(booking.services);
        } catch (e) {
          logger.error('Error parsing services JSON:', e);
          booking.services = [];
        }
      }
      // Ensure services is an array
      if (!Array.isArray(booking.services)) {
        booking.services = [];
      }
    } else {
      booking.services = [];
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
 * Get booking timeline (admin)
 */
async function getAdminBookingTimeline(req, res) {
  try {
    const { id } = req.params;

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (bookingError || !booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Build timeline from booking data
    const timeline = [];

    // Booking created
    if (booking.created_at) {
      timeline.push({
        id: `created-${booking.id}`,
        description: 'Booking created',
        timestamp: booking.created_at,
        user: 'System',
        type: 'created'
      });
    }

    // Status changes
    if (booking.status) {
      const statusMessages = {
        pending: 'Status set to pending',
        confirmed: 'Status changed to confirmed',
        completed: 'Status changed to completed',
        cancelled: 'Status changed to cancelled',
        refunded: 'Status changed to refunded'
      };
      
      timeline.push({
        id: `status-${booking.status}-${booking.id}`,
        description: statusMessages[booking.status] || `Status changed to ${booking.status}`,
        timestamp: booking.updated_at || booking.created_at,
        user: 'Admin',
        type: 'status_change'
      });
    }

    // Partner assigned
    if (booking.assigned_at && booking.partner_id) {
      timeline.push({
        id: `assigned-${booking.id}`,
        description: 'Partner assigned',
        timestamp: booking.assigned_at,
        user: 'Admin',
        type: 'partner_assigned'
      });
    }

    // Partner accepted
    if (booking.accepted_at) {
      timeline.push({
        id: `accepted-${booking.id}`,
        description: 'Partner accepted booking',
        timestamp: booking.accepted_at,
        user: 'Partner',
        type: 'accepted'
      });
    }

    // Cancelled
    if (booking.cancelled_at) {
      timeline.push({
        id: `cancelled-${booking.id}`,
        description: booking.cancellation_reason 
          ? `Booking cancelled: ${booking.cancellation_reason}`
          : 'Booking cancelled',
        timestamp: booking.cancelled_at,
        user: booking.status === 'cancelled' ? 'Admin' : 'System',
        type: 'cancelled'
      });
    }

    // Get admin notes if they exist
    if (booking.admin_notes && Array.isArray(booking.admin_notes)) {
      booking.admin_notes.forEach((note, index) => {
        timeline.push({
          id: `note-${booking.id}-${index}`,
          description: note.note || note,
          timestamp: note.added_at || note.timestamp || booking.updated_at,
          user: note.added_by || 'Admin',
          type: 'note'
        });
      });
    }

    // Sort timeline by timestamp (oldest first)
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return successResponse(res, timeline);
  } catch (error) {
    logger.error('Get admin booking timeline error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get booking invoice (admin)
 */
async function getAdminBookingInvoice(req, res) {
  try {
    const { id } = req.params;

    // Get booking with all related data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, users(*), partners(*), user_addresses(*)')
      .eq('id', id)
      .single();

    if (bookingError || !booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Parse services if needed
    let servicesArray = [];
    if (booking.services) {
      if (typeof booking.services === 'string') {
        try {
          servicesArray = JSON.parse(booking.services);
        } catch (e) {
          logger.error('Error parsing services JSON:', e);
          servicesArray = [];
        }
      } else if (Array.isArray(booking.services)) {
        servicesArray = booking.services;
      }
    }

    // Get payment info
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', id)
      .single();

    // Format address
    const address = booking.user_addresses || (Array.isArray(booking.user_addresses) ? booking.user_addresses[0] : null);
    const addressString = address 
      ? `${address.address_line1 || ''}${address.address_line2 ? ', ' + address.address_line2 : ''}, ${address.city || ''}, ${address.state || ''} - ${address.pincode || ''}`.trim()
      : 'Address not available';

    // Build invoice items from services
    const invoiceItems = servicesArray.map(service => ({
      service_name: service.name || service.service_name || 'Service',
      quantity: service.quantity || service.qty || 1,
      price: service.price || service.unit_price || service.productCost || service.marketPrice || service.product_cost || 0,
      total: (service.price || service.unit_price || service.productCost || service.marketPrice || service.product_cost || 0) * (service.quantity || service.qty || 1)
    }));

    // Generate invoice number (using booking number as base)
    const invoiceNumber = `INV-${booking.booking_number}`;

    // Build invoice object
    const invoice = {
      invoice_number: invoiceNumber,
      booking_number: booking.booking_number,
      date: booking.booking_date,
      time: booking.booking_time,
      customer: {
        name: booking.users?.name || booking.customer_name || 'N/A',
        phone: booking.users?.phone_number || booking.customer_phone || 'N/A',
        email: booking.users?.email || booking.customer_email || null,
        address: addressString
      },
      items: invoiceItems,
      subtotal: booking.total_price || 0,
      tax: booking.tax || 0,
      discount: booking.discount || 0,
      grand_total: booking.grand_total || booking.total_price || 0,
      payment: {
        method: booking.payment_method || payment?.payment_method || 'N/A',
        status: booking.payment_status || payment?.status || 'pending',
        razorpay_order_id: booking.razorpay_order_id || payment?.razorpay_order_id || null,
        razorpay_payment_id: booking.razorpay_payment_id || payment?.razorpay_payment_id || null
      },
      status: booking.status,
      promo_code: booking.promo_code || null,
      partner: booking.partners ? {
        name: booking.partners.name,
        code: booking.partners.partner_code
      } : null,
      created_at: booking.created_at
    };

    return successResponse(res, invoice);
  } catch (error) {
    logger.error('Get admin booking invoice error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminBookings,
  getAdminBookingById,
  updateBookingStatus,
  assignPartner,
  getAdminBookingTimeline,
  getAdminBookingInvoice
};

