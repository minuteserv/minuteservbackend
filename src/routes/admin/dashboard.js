const express = require('express');
const router = express.Router();
const { getAdminDashboard } = require('../../controllers/admin/dashboardController');
const { adminAuth } = require('../../middleware/adminAuth');

router.get('/', adminAuth, getAdminDashboard);

module.exports = router;

