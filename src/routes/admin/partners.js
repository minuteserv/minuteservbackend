const express = require('express');
const router = express.Router();
const { 
  getAdminPartners, 
  getAdminPartnersEnhanced,
  getAdminPartnerById, 
  createPartner, 
  updatePartner,
  getPartnerPerformance,
  getPartnerPayouts,
  processPartnerPayout,
  uploadPartnerDocument,
  updatePartnerAvailability,
} = require('../../controllers/admin/partnerController');
const { adminAuth } = require('../../middleware/adminAuth');

// List partners (enhanced with stats)
router.get('/', adminAuth, getAdminPartnersEnhanced);
router.get('/enhanced', adminAuth, getAdminPartnersEnhanced); // Alternative endpoint

// Individual partner routes
router.get('/:id', adminAuth, getAdminPartnerById);
router.get('/:id/performance', adminAuth, getPartnerPerformance);
router.get('/:id/payouts', adminAuth, getPartnerPayouts);

// Partner management
router.post('/', adminAuth, createPartner);
router.patch('/:id', adminAuth, updatePartner);
router.post('/:id/payouts/process', adminAuth, processPartnerPayout);
router.post('/:id/documents', adminAuth, uploadPartnerDocument);
router.patch('/:id/availability', adminAuth, updatePartnerAvailability);

module.exports = router;

