const express = require('express');
const router = express.Router();
const { applyPromoCode } = require('../controllers/promoController');
const { auth } = require('../middleware/auth');

router.post('/validate', auth, applyPromoCode);

module.exports = router;

