const express = require('express');
const router = express.Router();
const {
  sendOTPHandler,
  verifyOTPHandler,
  resendOTPHandler,
  refreshTokenHandler,
  getCurrentUser,
  logoutHandler
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// Public routes
router.post('/send-otp', sendOTPHandler);
router.post('/verify-otp', verifyOTPHandler);
router.post('/resend-otp', resendOTPHandler);
router.post('/refresh-token', refreshTokenHandler);

// Protected routes
router.get('/me', auth, getCurrentUser);
router.post('/logout', auth, logoutHandler);

module.exports = router;

