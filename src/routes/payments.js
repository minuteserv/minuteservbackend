const express = require('express');
const router = express.Router();
const {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatus,
  getAllPayments,
  getPaymentStats,
  markPaymentAsPaid,
  markBookingPaymentAsPaid,
} = require('../controllers/paymentController');
const { auth } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');

// Webhook doesn't require auth (Razorpay calls it)
router.post('/webhook', handleWebhook);

// Admin routes
router.get('/stats', adminAuth, getPaymentStats);
router.get('/', adminAuth, getAllPayments);
router.patch('/:id/mark-paid', adminAuth, markPaymentAsPaid);

// Protected routes
router.post('/create-order', auth, createPaymentOrder);
router.post('/verify', auth, verifyPayment);
router.get('/:id/status', auth, getPaymentStatus);

module.exports = router;

