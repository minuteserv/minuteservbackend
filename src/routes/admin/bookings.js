const express = require('express');
const router = express.Router();
const { getAdminBookings, getAdminBookingById, updateBookingStatus, assignPartner } = require('../../controllers/admin/bookingController');
const { adminAuth } = require('../../middleware/adminAuth');

router.get('/', adminAuth, getAdminBookings);
router.get('/:id', adminAuth, getAdminBookingById);
router.patch('/:id/status', adminAuth, updateBookingStatus);
router.post('/:id/assign-partner', adminAuth, assignPartner);

module.exports = router;

