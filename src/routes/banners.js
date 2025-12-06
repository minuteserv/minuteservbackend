const express = require('express');
const router = express.Router();
const marketingService = require('../services/marketingService');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Get active banners (public endpoint for frontend)
 */
router.get('/active', async (req, res) => {
  try {
    const position = req.query.position;
    const banners = await marketingService.getActiveBanners(position);
    return successResponse(res, banners);
  } catch (error) {
    return errorResponse(res, error, 500);
  }
});

/**
 * Track banner impression (public endpoint)
 */
router.post('/:id/impression', async (req, res) => {
  try {
    const { id } = req.params;
    await marketingService.trackBannerImpression(id);
    return successResponse(res, null, 'Impression tracked');
  } catch (error) {
    // Don't fail the request if tracking fails
    return successResponse(res, null, 'Impression tracked');
  }
});

/**
 * Track banner click (public endpoint)
 */
router.post('/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    await marketingService.trackBannerClick(id);
    return successResponse(res, null, 'Click tracked');
  } catch (error) {
    // Don't fail the request if tracking fails
    return successResponse(res, null, 'Click tracked');
  }
});

module.exports = router;

