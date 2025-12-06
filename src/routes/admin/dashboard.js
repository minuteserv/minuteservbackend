const express = require('express');
const router = express.Router();
const { 
  getAdminDashboard, 
  getChartData, 
  getTodaySchedule,
  getCategoryBreakdown 
} = require('../../controllers/admin/dashboardController');
const { adminAuth } = require('../../middleware/adminAuth');

router.get('/', adminAuth, getAdminDashboard);
router.get('/chart', adminAuth, getChartData);
router.get('/today-schedule', adminAuth, getTodaySchedule);
router.get('/category-breakdown', adminAuth, getCategoryBreakdown);

module.exports = router;

