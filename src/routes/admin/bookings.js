const express = require('express');
const router = express.Router();
const { getAdminBookings, getAdminBookingById, updateBookingStatus, assignPartner, getAdminBookingTimeline, getAdminBookingInvoice } = require('../../controllers/admin/bookingController');
const { adminAuth } = require('../../middleware/adminAuth');

router.get('/', adminAuth, getAdminBookings);
router.get('/:id', adminAuth, getAdminBookingById);
router.get('/:id/timeline', adminAuth, getAdminBookingTimeline);
router.get('/:id/invoice', adminAuth, getAdminBookingInvoice);
router.patch('/:id/status', adminAuth, updateBookingStatus);
router.post('/:id/assign-partner', adminAuth, assignPartner);

module.exports = router;

