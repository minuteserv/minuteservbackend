const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middleware/adminAuth');
const reviewsController = require('../../controllers/admin/reviewsController');

// Apply admin auth middleware to all routes
router.use(adminAuth);

// ============================================
// REVIEWS DASHBOARD
// ============================================
router.get('/dashboard', reviewsController.getReviewsDashboard);

// ============================================
// ANALYTICS ROUTES (Must come before /:id routes)
// ============================================
router.get('/analytics/breakdown', reviewsController.getRatingBreakdown);
router.get('/analytics/feedback', reviewsController.getFeedbackAnalysis);
router.get('/service/:serviceId', reviewsController.getReviewsByService);
router.get('/partner/:partnerId', reviewsController.getReviewsByPartner);

// ============================================
// REVIEW RESPONSES ROUTES (Must come before /:id routes)
// ============================================
router.put('/responses/:responseId', reviewsController.updateResponse);
router.delete('/responses/:responseId', reviewsController.deleteResponse);

// ============================================
// REVIEWS ROUTES
// ============================================
router.get('/', reviewsController.getAllReviews);
router.get('/:id', reviewsController.getReviewById);
router.post('/', reviewsController.createReview);
router.put('/:id', reviewsController.updateReview);
router.delete('/:id', reviewsController.deleteReview);

// Moderate review
router.post('/:id/moderate', reviewsController.moderateReview);

// Add response to review
router.post('/:id/responses', reviewsController.addReviewResponse);

module.exports = router;

