const express = require('express');
const router = express.Router();
const { 
  getAdminUsers, 
  getAdminUserById, 
  getAdminUserBookings,
  toggleUserBlock,
  getCustomerStats 
} = require('../../controllers/admin/userController');
const { adminAuth } = require('../../middleware/adminAuth');

// Stats endpoint (must be before /:id routes)
router.get('/stats', adminAuth, getCustomerStats);

// User CRUD
router.get('/', adminAuth, getAdminUsers);
router.get('/:id', adminAuth, getAdminUserById);
router.get('/:id/bookings', adminAuth, getAdminUserBookings);
router.patch('/:id/block', adminAuth, toggleUserBlock);

module.exports = router;

