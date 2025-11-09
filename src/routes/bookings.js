const express = require('express');
const router = express.Router();
const {
  getUserBookings,
  getBookingById,
  cancelBooking,
  rateBooking
} = require('../controllers/bookingController');
const { auth } = require('../middleware/auth');

router.get('/', auth, getUserBookings);
router.get('/:id', auth, getBookingById);
router.post('/:id/cancel', auth, cancelBooking);
router.post('/:id/rate', auth, rateBooking);

module.exports = router;

