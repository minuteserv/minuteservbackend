const express = require('express');
const router = express.Router();
const { getAdminPartners, getAdminPartnerById, createPartner, updatePartner } = require('../../controllers/admin/partnerController');
const { adminAuth } = require('../../middleware/adminAuth');

router.get('/', adminAuth, getAdminPartners);
router.get('/:id', adminAuth, getAdminPartnerById);
router.post('/', adminAuth, createPartner);
router.patch('/:id', adminAuth, updatePartner);

module.exports = router;

