const express = require('express');
const router = express.Router();
const {
  getPayoutsDashboard,
  getPendingPayouts,
  getPayoutHistory,
  processBatchPayouts,
  getPayoutById,
  generateInvoice,
  getInvoices,
  getInvoiceById,
  getPLDashboard,
  getPLStatements,
  getGSTReports,
  generateGSTReport,
  getReconciliation,
  performReconciliation,
  calculateCommissions,
  getCommissionCalculations,
} = require('../../controllers/admin/payoutsController');
const { adminAuth } = require('../../middleware/adminAuth');

// Dashboard
router.get('/dashboard', adminAuth, getPayoutsDashboard);

// Payouts - Specific routes must come BEFORE parameterized routes
router.get('/pending', adminAuth, getPendingPayouts);
router.get('/history', adminAuth, getPayoutHistory);
router.post('/batch-process', adminAuth, processBatchPayouts);

// Commissions - Must come before /:id
router.get('/commissions', adminAuth, getCommissionCalculations);
router.post('/commissions/calculate', adminAuth, calculateCommissions);

// Invoices - Must come before /:id
router.get('/invoices', adminAuth, getInvoices);
router.post('/invoices/generate', adminAuth, generateInvoice);
router.get('/invoices/:id', adminAuth, getInvoiceById);

// P&L Dashboard - Must come before /:id
router.get('/pl/dashboard', adminAuth, getPLDashboard);
router.get('/pl/statements', adminAuth, getPLStatements);

// GST Reports - Must come before /:id
router.get('/gst/reports', adminAuth, getGSTReports);
router.post('/gst/generate', adminAuth, generateGSTReport);

// Reconciliation - Must come before /:id
router.get('/reconciliation', adminAuth, getReconciliation);
router.post('/reconciliation/perform', adminAuth, performReconciliation);

// Parameterized routes must come LAST
router.get('/:id', adminAuth, getPayoutById);

module.exports = router;

