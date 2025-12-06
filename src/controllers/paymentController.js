const supabase = require('../config/supabase');
const { createOrder, verifySignature, verifyWebhookSignature, getPaymentDetails } = require('../services/razorpayService');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Create Razorpay payment order
 */
async function createPaymentOrder(req, res) {
  try {
    const { booking_id } = req.body;
    const userId = req.user.id;

    if (!booking_id) {
      return errorResponse(res, { message: 'Booking ID is required' }, 400);
    }

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('user_id', userId)
      .single();

    if (bookingError || !booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    if (booking.payment_status === 'paid') {
      return errorResponse(res, { message: 'Booking already paid' }, 400);
    }

    // Create Razorpay order
    const orderResult = await createOrder(
      booking.grand_total,
      booking.booking_number,
      {
        booking_id: booking.id,
        booking_number: booking.booking_number
      }
    );

    // Store payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id: booking.id,
        razorpay_order_id: orderResult.order_id,
        amount: booking.grand_total,
        status: 'pending'
      })
      .select()
      .single();

    if (paymentError) {
      logger.error('Create payment record error:', paymentError);
      throw new Error('Failed to create payment record');
    }

    // Update booking with order ID
    await supabase
      .from('bookings')
      .update({ razorpay_order_id: orderResult.order_id })
      .eq('id', booking.id);

    return successResponse(res, {
      order_id: orderResult.order_id,
      amount: orderResult.amount,
      currency: orderResult.currency,
      key: process.env.RAZORPAY_KEY_ID,
      name: 'Minuteserv',
      description: `Booking ${booking.booking_number}`,
      prefill: {
        contact: booking.customer_phone,
        email: booking.customer_email || '',
        name: booking.customer_name
      },
      notes: {
        booking_id: booking.id,
        booking_number: booking.booking_number
      }
    });
  } catch (error) {
    logger.error('Create payment order error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Verify payment (manual verification)
 */
async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return errorResponse(res, { message: 'Payment details are required' }, 400);
    }

    // Verify signature
    const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValid) {
      return errorResponse(res, { message: 'Invalid payment signature' }, 400);
    }

    // Get payment record
    const { data: payment } = await supabase
      .from('payments')
      .select('*, bookings(*)')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (!payment || payment.bookings.user_id !== userId) {
      return errorResponse(res, { message: 'Payment not found' }, 404);
    }

    // Update payment status
    await supabase
      .from('payments')
      .update({
        razorpay_payment_id: razorpay_payment_id,
        status: 'success'
      })
      .eq('id', payment.id);

    // Update booking status
    await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        razorpay_payment_id: razorpay_payment_id,
        status: 'pending' // Ready for partner assignment
      })
      .eq('id', payment.booking_id);

    // TODO: Trigger partner assignment

    return successResponse(res, {
      booking_id: payment.booking_id,
      payment_status: 'success',
      booking_status: 'pending'
    });
  } catch (error) {
    logger.error('Verify payment error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Handle Razorpay webhook
 */
async function handleWebhook(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const payload = req.body;

    // Verify webhook signature
    const isValid = verifyWebhookSignature(payload, signature);

    if (!isValid) {
      logger.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = payload.event;
    const paymentData = payload.payload?.payment?.entity;

    if (!paymentData) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Check if already processed (idempotency)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('razorpay_payment_id', paymentData.id)
      .single();

    if (existingPayment && existingPayment.status === 'success') {
      logger.info('Webhook already processed:', paymentData.id);
      return res.json({ success: true, message: 'Already processed' });
    }

    // Process event
    if (event === 'payment.captured') {
      // Find payment by order_id
      const { data: payment } = await supabase
        .from('payments')
        .select('*, bookings(*)')
        .eq('razorpay_order_id', paymentData.order_id)
        .single();

      if (payment) {
        // Update payment
        await supabase
          .from('payments')
          .update({
            razorpay_payment_id: paymentData.id,
            status: 'success',
            payment_method: paymentData.method
          })
          .eq('id', payment.id);

        // Update booking
        await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            razorpay_payment_id: paymentData.id,
            status: 'pending' // Ready for partner assignment
          })
          .eq('id', payment.booking_id);

        // TODO: Trigger partner assignment
        logger.info('Payment captured successfully:', paymentData.id);
      }
    } else if (event === 'payment.failed') {
      // Handle payment failure
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('razorpay_order_id', paymentData.order_id)
        .single();

      if (payment) {
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            failure_reason: paymentData.error_description || 'Payment failed'
          })
          .eq('id', payment.id);

        logger.info('Payment failed:', paymentData.id);
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

/**
 * Get payment status
 */
async function getPaymentStatus(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: payment, error } = await supabase
      .from('payments')
      .select('*, bookings(*)')
      .eq('id', id)
      .single();

    if (error || !payment) {
      return errorResponse(res, { message: 'Payment not found' }, 404);
    }

    if (payment.bookings.user_id !== userId) {
      return errorResponse(res, { message: 'Unauthorized' }, 403);
    }

    return successResponse(res, {
      payment_id: payment.id,
      status: payment.status,
      amount: payment.amount,
      payment_method: payment.payment_method,
      razorpay_payment_id: payment.razorpay_payment_id,
      booking_id: payment.booking_id,
      created_at: payment.created_at
    });
  } catch (error) {
    logger.error('Get payment status error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get all payments (admin) with customer info
 */
async function getAllPayments(req, res) {
  try {
    const { status, booking_id, start_date, end_date, limit = 100 } = req.query;

    let query = supabase
      .from('payments')
      .select(`
        *,
        bookings(
          id, 
          booking_number, 
          status, 
          grand_total,
          customer_name,
          customer_phone,
          user_id,
          users(id, name, phone_number)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) query = query.eq('status', status);
    if (booking_id) query = query.eq('booking_id', booking_id);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data: payments, error } = await query;

    if (error) {
      logger.error('Get all payments error:', error);
      throw new Error('Failed to fetch payments');
    }

    // Flatten customer data for easier frontend access
    const enrichedPayments = (payments || []).map(payment => ({
      ...payment,
      customer_name: payment.bookings?.customer_name || payment.bookings?.users?.name || 'N/A',
      customer_phone: payment.bookings?.customer_phone || payment.bookings?.users?.phone_number || '',
      booking_number: payment.bookings?.booking_number || payment.booking_id,
    }));

    return successResponse(res, enrichedPayments);
  } catch (error) {
    logger.error('Get all payments error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get payment stats (admin)
 */
async function getPaymentStats(req, res) {
  try {
    // Total revenue (all paid payments)
    const { data: paidPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid');

    const totalRevenue = paidPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Pending amount
    const { data: pendingPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'pending');

    const pendingAmount = pendingPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
    const pendingCount = pendingPayments?.length || 0;

    // Refunded amount
    const { data: refundedPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'refunded');

    const refundedAmount = refundedPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
    const refundedCount = refundedPayments?.length || 0;

    // Today's collection
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid')
      .gte('created_at', today.toISOString());

    const todayCollection = todayPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
    const todayCount = todayPayments?.length || 0;

    // This month's collection
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid')
      .gte('created_at', startOfMonth.toISOString());

    const monthCollection = monthPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Count by status
    const { count: totalCount } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true });

    const { count: paidCount } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paid');

    const { count: failedCount } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    return successResponse(res, {
      total_revenue: totalRevenue,
      pending_amount: pendingAmount,
      pending_count: pendingCount,
      refunded_amount: refundedAmount,
      refunded_count: refundedCount,
      today_collection: todayCollection,
      today_count: todayCount,
      month_collection: monthCollection,
      total_count: totalCount || 0,
      paid_count: paidCount || 0,
      failed_count: failedCount || 0,
    });
  } catch (error) {
    logger.error('Get payment stats error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Mark payment as paid (Admin - for offline payments)
 */
async function markPaymentAsPaid(req, res) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, bookings(*)')
      .eq('id', id)
      .single();

    if (paymentError || !payment) {
      return errorResponse(res, { message: 'Payment not found' }, 404);
    }

    // Check if already paid
    if (payment.status === 'paid' || payment.status === 'success') {
      return errorResponse(res, { message: 'Payment is already marked as paid' }, 400);
    }

    // Update payment status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        notes: notes || payment.notes || 'Marked as paid by admin (offline payment)',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Update payment status error:', updateError);
      throw new Error('Failed to update payment status');
    }

    // Update booking payment status
    if (payment.booking_id) {
      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.booking_id);

      if (bookingUpdateError) {
        logger.error('Update booking payment status error:', bookingUpdateError);
        // Don't fail the request, payment is already updated
      }
    }

    logger.info(`Payment ${id} marked as paid by admin`);

    return successResponse(res, {
      payment: updatedPayment,
      message: 'Payment marked as paid successfully',
    });
  } catch (error) {
    logger.error('Mark payment as paid error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Mark booking payment as paid (Admin - creates payment if doesn't exist)
 */
async function markBookingPaymentAsPaid(req, res) {
  try {
    const { id } = req.params;
    const { notes, payment_method = 'cash' } = req.body;

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (bookingError || !booking) {
      return errorResponse(res, { message: 'Booking not found' }, 404);
    }

    // Check if already paid
    if (booking.payment_status === 'paid') {
      return errorResponse(res, { message: 'Booking is already marked as paid' }, 400);
    }

    // Check if payment record exists
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', id)
      .single();

    let payment;

    if (existingPayment) {
      // Update existing payment
      const { data: updatedPayment, error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          payment_method: payment_method,
          paid_at: new Date().toISOString(),
          notes: notes || existingPayment.notes || 'Marked as paid by admin (offline payment)',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPayment.id)
        .select()
        .single();

      if (updateError) {
        logger.error('Update payment error:', updateError);
        throw new Error('Failed to update payment');
      }

      payment = updatedPayment;
    } else {
      // Create new payment record
      const { data: newPayment, error: createError } = await supabase
        .from('payments')
        .insert({
          booking_id: id,
          amount: booking.grand_total,
          payment_method: payment_method,
          status: 'paid',
          paid_at: new Date().toISOString(),
          notes: notes || 'Marked as paid by admin (offline payment)',
        })
        .select()
        .single();

      if (createError) {
        logger.error('Create payment error:', createError);
        throw new Error('Failed to create payment record');
      }

      payment = newPayment;
    }

    // Update booking payment status
    const { data: updatedBooking, error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        payment_method: payment_method,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (bookingUpdateError) {
      logger.error('Update booking payment status error:', bookingUpdateError);
      throw new Error('Failed to update booking payment status');
    }

    logger.info(`Booking ${id} payment marked as paid by admin`);

    return successResponse(res, {
      payment: payment,
      booking: updatedBooking,
      message: 'Payment marked as paid successfully',
    });
  } catch (error) {
    logger.error('Mark booking payment as paid error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatus,
  getAllPayments,
  getPaymentStats,
  markPaymentAsPaid,
  markBookingPaymentAsPaid,
};

