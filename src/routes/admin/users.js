const express = require('express');
const router = express.Router();
const { getAdminUsers, getAdminUserById, getAdminUserBookings } = require('../../controllers/admin/userController');
const { adminAuth } = require('../../middleware/adminAuth');

router.get('/', adminAuth, getAdminUsers);
router.get('/:id', adminAuth, getAdminUserById);
router.get('/:id/bookings', adminAuth, getAdminUserBookings);

module.exports = router;

