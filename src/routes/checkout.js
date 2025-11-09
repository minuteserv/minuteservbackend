const express = require('express');
const router = express.Router();
const {
  prepareCheckout,
  confirmBooking
} = require('../controllers/checkoutController');
const { auth } = require('../middleware/auth');

router.post('/prepare', auth, prepareCheckout);
router.post('/confirm', auth, confirmBooking);

module.exports = router;

