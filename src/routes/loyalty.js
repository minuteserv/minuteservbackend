const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get points balance and tier info
router.get('/balance', loyaltyController.getBalance);

// Get points transaction history
router.get('/history', loyaltyController.getHistory);

// Redeem points
router.post('/redeem', loyaltyController.redeemPoints);

// Apply redemption to booking
router.post('/apply-redemption', loyaltyController.applyRedemption);

// Get all tiers information
router.get('/tiers', loyaltyController.getTiers);

module.exports = router;

