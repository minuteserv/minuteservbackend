const express = require('express');
const router = express.Router();
const { 
  getAdminBookings, 
  getAdminBookingById, 
  updateBookingStatus, 
  assignPartner,
  duplicateBooking,
  getBookingTimeline,
  addBookingNote,
  bulkUpdateStatus,
  getBookingInvoice,
  processBookingRefund,
} = require('../../controllers/admin/bookingController');
const { markBookingPaymentAsPaid } = require('../../controllers/paymentController');
const { adminAuth } = require('../../middleware/adminAuth');

// Bulk operations (must be before /:id routes)
router.post('/bulk-update-status', adminAuth, bulkUpdateStatus);

// Individual booking routes
router.get('/', adminAuth, getAdminBookings);
router.get('/:id', adminAuth, getAdminBookingById);
router.get('/:id/timeline', adminAuth, getBookingTimeline);
router.get('/:id/invoice', adminAuth, getBookingInvoice);
router.patch('/:id/status', adminAuth, updateBookingStatus);
router.post('/:id/assign-partner', adminAuth, assignPartner);
router.post('/:id/duplicate', adminAuth, duplicateBooking);
router.post('/:id/notes', adminAuth, addBookingNote);
router.post('/:id/refund', adminAuth, processBookingRefund);
router.post('/:id/mark-paid', adminAuth, markBookingPaymentAsPaid);

module.exports = router;

