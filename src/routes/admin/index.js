const express = require('express');
const router = express.Router();
const adminAuthRoutes = require('./auth');
const adminBookingRoutes = require('./bookings');
const adminPartnerRoutes = require('./partners');
const adminServiceRoutes = require('./services');
const adminDashboardRoutes = require('./dashboard');
const adminUserRoutes = require('./users');
const adminTicketRoutes = require('./tickets');
const adminAnalyticsRoutes = require('./analytics');
const adminMarketingRoutes = require('./marketing');
const adminInventoryRoutes = require('./inventory');
const adminReviewsRoutes = require('./reviews');
const adminPayoutsRoutes = require('./payouts');
const adminDocumentsRoutes = require('./documents');
const adminCredentialsRoutes = require('./credentials');

// Admin routes
router.use('/auth', adminAuthRoutes);
router.use('/dashboard', adminDashboardRoutes);
router.use('/bookings', adminBookingRoutes);
router.use('/partners', adminPartnerRoutes);
router.use('/services', adminServiceRoutes);
router.use('/users', adminUserRoutes);
router.use('/tickets', adminTicketRoutes);
router.use('/analytics', adminAnalyticsRoutes);
router.use('/marketing', adminMarketingRoutes);
router.use('/inventory', adminInventoryRoutes);
router.use('/reviews', adminReviewsRoutes);
router.use('/payouts', adminPayoutsRoutes);
router.use('/documents', adminDocumentsRoutes);
router.use('/credentials', adminCredentialsRoutes);

module.exports = router;

