const express = require('express');
const router = express.Router();
const { getServiceCatalog, getAllServices, getServiceById } = require('../controllers/serviceController');

router.get('/', getAllServices); // GET /api/v1/services - returns all services
router.get('/catalog', getServiceCatalog); // GET /api/v1/services/catalog - returns grouped by category
router.get('/:id', getServiceById); // GET /api/v1/services/:id - returns single service

module.exports = router;

