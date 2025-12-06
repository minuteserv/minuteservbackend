const express = require('express');
const router = express.Router();
const {
  getRevenueByCategory,
  getPeakHoursAnalysis,
  getCustomerAcquisitionFunnel,
  getPartnerPerformanceComparison,
  getGeographicHeatmap,
  getCohortAnalysis,
  getServicePopularity,
  getAOVTrends,
  getAnalyticsDashboard,
} = require('../../controllers/admin/analyticsController');
const { adminAuth } = require('../../middleware/adminAuth');

// All analytics routes require admin authentication
router.get('/dashboard', adminAuth, getAnalyticsDashboard);
router.get('/revenue-by-category', adminAuth, getRevenueByCategory);
router.get('/peak-hours', adminAuth, getPeakHoursAnalysis);
router.get('/customer-funnel', adminAuth, getCustomerAcquisitionFunnel);
router.get('/partner-performance', adminAuth, getPartnerPerformanceComparison);
router.get('/geographic', adminAuth, getGeographicHeatmap);
router.get('/cohort', adminAuth, getCohortAnalysis);
router.get('/service-popularity', adminAuth, getServicePopularity);
router.get('/aov-trends', adminAuth, getAOVTrends);

module.exports = router;

