const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middleware/adminAuth');
const marketingController = require('../../controllers/admin/marketingController');

// Apply admin auth middleware to all routes
router.use(adminAuth);

// ============================================
// MARKETING DASHBOARD
// ============================================
router.get('/dashboard', marketingController.getMarketingDashboard);

// ============================================
// PROMO CODES ROUTES
// ============================================
router.get('/promo-codes', marketingController.getAllPromoCodes);
router.get('/promo-codes/:id', marketingController.getPromoCodeById);
router.post('/promo-codes', marketingController.createPromoCode);
router.put('/promo-codes/:id', marketingController.updatePromoCode);
router.delete('/promo-codes/:id', marketingController.deletePromoCode);
router.post('/promo-codes/reconcile', marketingController.reconcilePromoCodeUsage);

// ============================================
// CAMPAIGNS ROUTES
// ============================================
router.get('/campaigns', marketingController.getAllCampaigns);
router.get('/campaigns/:id', marketingController.getCampaignById);
router.post('/campaigns', marketingController.createCampaign);
router.put('/campaigns/:id', marketingController.updateCampaign);

// ============================================
// BANNERS ROUTES
// ============================================
router.get('/banners', marketingController.getAllBanners);
router.get('/banners/active', marketingController.getActiveBanners); // Public endpoint (no auth needed)
router.post('/banners', marketingController.createBanner);
router.put('/banners/:id', marketingController.updateBanner);
router.delete('/banners/:id', marketingController.deleteBanner);

// ============================================
// NOTIFICATIONS ROUTES
// ============================================
router.get('/notifications', marketingController.getAllNotifications);
router.get('/notifications/:id', marketingController.getNotificationById);
router.post('/notifications', marketingController.createNotification);

// ============================================
// REFERRALS ROUTES
// ============================================
router.get('/referrals', marketingController.getAllReferrals);
router.get('/referrals/stats', marketingController.getReferralStats);

module.exports = router;

