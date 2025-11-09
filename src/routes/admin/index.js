const express = require('express');
const router = express.Router();
const adminAuthRoutes = require('./auth');
const adminBookingRoutes = require('./bookings');
const adminPartnerRoutes = require('./partners');
const adminServiceRoutes = require('./services');
const adminDashboardRoutes = require('./dashboard');
const adminUserRoutes = require('./users');

// Admin routes
router.use('/auth', adminAuthRoutes);
router.use('/dashboard', adminDashboardRoutes);
router.use('/bookings', adminBookingRoutes);
router.use('/partners', adminPartnerRoutes);
router.use('/services', adminServiceRoutes);
router.use('/users', adminUserRoutes);

module.exports = router;

