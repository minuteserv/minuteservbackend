const { successResponse, errorResponse } = require('../../utils/response');
const reviewsService = require('../../services/reviewsService');
const logger = require('../../utils/logger');

// ============================================
// DASHBOARD
// ============================================

/**
 * Get reviews dashboard stats
 */
async function getReviewsDashboard(req, res) {
  try {
    const stats = await reviewsService.getReviewsDashboard();
    return successResponse(res, stats);
  } catch (error) {
    logger.error('Get reviews dashboard error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// REVIEWS CONTROLLERS
// ============================================

/**
 * Get all reviews
 */
async function getAllReviews(req, res) {
  try {
    const filters = {
      status: req.query.status,
      rating: req.query.rating,
      service_id: req.query.service_id,
      partner_id: req.query.partner_id,
      user_id: req.query.user_id,
      is_featured: req.query.is_featured !== undefined ? req.query.is_featured === 'true' : undefined,
      search: req.query.search,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };

    const reviews = await reviewsService.getAllReviews(filters);
    return successResponse(res, reviews);
  } catch (error) {
    logger.error('Get all reviews error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get review by ID
 */
async function getReviewById(req, res) {
  try {
    const { id } = req.params;
    const review = await reviewsService.getReviewById(id);

    if (!review) {
      return errorResponse(res, { message: 'Review not found' }, 404);
    }

    return successResponse(res, review);
  } catch (error) {
    logger.error('Get review by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create review
 */
async function createReview(req, res) {
  try {
    const review = await reviewsService.createReview(req.body);
    return successResponse(res, review, 'Review created successfully', 201);
  } catch (error) {
    logger.error('Create review error:', error);
    const message = error.message || 'Failed to create review';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Update review
 */
async function updateReview(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const review = await reviewsService.updateReview(id, updates);
    return successResponse(res, review, 'Review updated successfully');
  } catch (error) {
    logger.error('Update review error:', error);
    const message = error.message || 'Failed to update review';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Moderate review (approve/reject/hide)
 */
async function moderateReview(req, res) {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    if (!action || !['approve', 'reject', 'hide', 'pending'].includes(action)) {
      return errorResponse(res, { message: 'Invalid action. Use: approve, reject, hide, or pending' }, 400);
    }

    const review = await reviewsService.moderateReview(id, action, req.admin?.id, notes);
    return successResponse(res, review, `Review ${action}d successfully`);
  } catch (error) {
    logger.error('Moderate review error:', error);
    const message = error.message || 'Failed to moderate review';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Delete review
 */
async function deleteReview(req, res) {
  try {
    const { id } = req.params;
    await reviewsService.deleteReview(id);
    return successResponse(res, null, 'Review deleted successfully');
  } catch (error) {
    logger.error('Delete review error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// REVIEW RESPONSES CONTROLLERS
// ============================================

/**
 * Add response to review
 */
async function addReviewResponse(req, res) {
  try {
    const { id } = req.params;
    const responseData = {
      ...req.body,
      responder_type: 'admin',
      responder_id: req.admin?.id,
    };

    const response = await reviewsService.addReviewResponse(id, responseData);
    return successResponse(res, response, 'Response added successfully', 201);
  } catch (error) {
    logger.error('Add review response error:', error);
    const message = error.message || 'Failed to add response';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Update response
 */
async function updateResponse(req, res) {
  try {
    const { responseId } = req.params;
    const updates = req.body;

    const response = await reviewsService.updateResponse(responseId, updates);
    return successResponse(res, response, 'Response updated successfully');
  } catch (error) {
    logger.error('Update response error:', error);
    const message = error.message || 'Failed to update response';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Delete response
 */
async function deleteResponse(req, res) {
  try {
    const { responseId } = req.params;
    await reviewsService.deleteResponse(responseId);
    return successResponse(res, null, 'Response deleted successfully');
  } catch (error) {
    logger.error('Delete response error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// ANALYTICS CONTROLLERS
// ============================================

/**
 * Get rating breakdown
 */
async function getRatingBreakdown(req, res) {
  try {
    const filters = {
      service_id: req.query.service_id,
      partner_id: req.query.partner_id,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };

    const breakdown = await reviewsService.getRatingBreakdown(filters);
    return successResponse(res, breakdown);
  } catch (error) {
    logger.error('Get rating breakdown error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get feedback analysis
 */
async function getFeedbackAnalysis(req, res) {
  try {
    const filters = {
      service_id: req.query.service_id,
      partner_id: req.query.partner_id,
    };

    const analysis = await reviewsService.getFeedbackAnalysis(filters);
    return successResponse(res, analysis);
  } catch (error) {
    logger.error('Get feedback analysis error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get reviews by service
 */
async function getReviewsByService(req, res) {
  try {
    const { serviceId } = req.params;
    const reviews = await reviewsService.getReviewsByService(serviceId);
    return successResponse(res, reviews);
  } catch (error) {
    logger.error('Get reviews by service error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get reviews by partner
 */
async function getReviewsByPartner(req, res) {
  try {
    const { partnerId } = req.params;
    const reviews = await reviewsService.getReviewsByPartner(partnerId);
    return successResponse(res, reviews);
  } catch (error) {
    logger.error('Get reviews by partner error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  // Dashboard
  getReviewsDashboard,
  // Reviews
  getAllReviews,
  getReviewById,
  createReview,
  updateReview,
  moderateReview,
  deleteReview,
  // Responses
  addReviewResponse,
  updateResponse,
  deleteResponse,
  // Analytics
  getRatingBreakdown,
  getFeedbackAnalysis,
  getReviewsByService,
  getReviewsByPartner,
};

