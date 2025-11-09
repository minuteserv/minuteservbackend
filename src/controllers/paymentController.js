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
 * Get all payments (admin)
 */
async function getAllPayments(req, res) {
  try {
    const { status, booking_id, limit = 100 } = req.query;

    let query = supabase
      .from('payments')
      .select('*, bookings(id, booking_number, status, grand_total)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) query = query.eq('status', status);
    if (booking_id) query = query.eq('booking_id', booking_id);

    const { data: payments, error } = await query;

    if (error) {
      logger.error('Get all payments error:', error);
      throw new Error('Failed to fetch payments');
    }

    return successResponse(res, payments || []);
  } catch (error) {
    logger.error('Get all payments error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatus,
  getAllPayments
};

