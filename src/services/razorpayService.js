const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Initialize Razorpay only if keys are provided (optional for development)
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  logger.warn('⚠️  Razorpay keys not configured. Payment features will be disabled.');
}

/**
 * Create Razorpay order
 */
async function createOrder(amount, receipt, notes = {}) {
  if (!razorpay) {
    throw new Error('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  }
  try {
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: receipt,
      notes: notes
    };

    const order = await razorpay.orders.create(options);

    return {
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    };
  } catch (error) {
    logger.error('Create Razorpay order error:', error);
    throw new Error('Failed to create payment order');
  }
}

/**
 * Verify Razorpay signature
 */
function verifySignature(orderId, paymentId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    logger.warn('Razorpay key secret not configured. Signature verification skipped.');
    return false;
  }
  try {
    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    return generatedSignature === signature;
  } catch (error) {
    logger.error('Verify signature error:', error);
    return false;
  }
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  try {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    return generatedSignature === signature;
  } catch (error) {
    logger.error('Verify webhook signature error:', error);
    return false;
  }
}

/**
 * Fetch payment details from Razorpay
 */
async function getPaymentDetails(paymentId) {
  if (!razorpay) {
    throw new Error('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  }
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    logger.error('Get payment details error:', error);
    throw new Error('Failed to fetch payment details');
  }
}

module.exports = {
  createOrder,
  verifySignature,
  verifyWebhookSignature,
  getPaymentDetails
};

