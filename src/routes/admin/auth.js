const express = require('express');
const router = express.Router();
const { adminLogin } = require('../../controllers/admin/authController');

router.post('/login', adminLogin);

module.exports = router;

