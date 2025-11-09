const express = require('express');
const router = express.Router();
const { getAdminServices, createService, updateService } = require('../../controllers/admin/serviceController');
const { adminAuth } = require('../../middleware/adminAuth');

router.get('/', adminAuth, getAdminServices);
router.post('/', adminAuth, createService);
router.put('/:id', adminAuth, updateService);

module.exports = router;

