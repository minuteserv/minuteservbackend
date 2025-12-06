const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Reviews & Customer Experience Service
 * Comprehensive service for managing customer reviews and ratings
 */

// ============================================
// DASHBOARD & STATISTICS
// ============================================

/**
 * Get reviews dashboard stats
 */
async function getReviewsDashboard() {
  try {
    // Total reviews
    const { count: totalReviews } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true });

    // Approved reviews
    const { count: approvedReviews } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    // Pending reviews
    const { count: pendingReviews } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Average rating
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('status', 'approved');

    const totalRating = reviews?.reduce((sum, r) => sum + (r.rating || 0), 0) || 0;
    const averageRating = reviews?.length > 0 ? totalRating / reviews.length : 0;

    // Rating breakdown
    const ratingBreakdown = {
      5: reviews?.filter(r => r.rating === 5).length || 0,
      4: reviews?.filter(r => r.rating === 4).length || 0,
      3: reviews?.filter(r => r.rating === 3).length || 0,
      2: reviews?.filter(r => r.rating === 2).length || 0,
      1: reviews?.filter(r => r.rating === 1).length || 0,
    };

    return {
      total: totalReviews || 0,
      approved: approvedReviews || 0,
      pending: pendingReviews || 0,
      average_rating: Math.round(averageRating * 10) / 10,
      rating_breakdown: ratingBreakdown,
    };
  } catch (error) {
    logger.error('Get reviews dashboard error:', error);
    throw error;
  }
}

// ============================================
// REVIEWS MANAGEMENT
// ============================================

/**
 * Get all reviews with filters
 */
async function getAllReviews(filters = {}) {
  try {
    let query = supabase
      .from('reviews')
      .select(`
        *,
        user:user_id (id, name, phone_number),
        booking:booking_id (id, booking_number),
        partner:partner_id (id, name, phone_number),
        service:service_id (id, name)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.rating) {
      query = query.eq('rating', parseInt(filters.rating));
    }
    if (filters.service_id) {
      query = query.eq('service_id', filters.service_id);
    }
    if (filters.partner_id) {
      query = query.eq('partner_id', filters.partner_id);
    }
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters.is_featured !== undefined) {
      query = query.eq('is_featured', filters.is_featured);
    }
    if (filters.search) {
      query = query.or(`comment.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get responses for each review
    const reviewsWithResponses = await Promise.all(
      (data || []).map(async (review) => {
        const { data: responses } = await supabase
          .from('review_responses')
          .select(`
            *,
            admin:responder_id (id, name)
          `)
          .eq('review_id', review.id)
          .order('created_at', { ascending: true });

        return {
          ...review,
          responses: responses || [],
        };
      })
    );

    return reviewsWithResponses;
  } catch (error) {
    logger.error('Get all reviews error:', error);
    throw error;
  }
}

/**
 * Get review by ID
 */
async function getReviewById(id) {
  try {
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select(`
        *,
        user:user_id (id, name, phone_number),
        booking:booking_id (id, booking_number, grand_total),
        partner:partner_id (id, name, phone_number),
        service:service_id (id, name)
      `)
      .eq('id', id)
      .single();

    if (reviewError) throw reviewError;

    // Get responses
    const { data: responses } = await supabase
      .from('review_responses')
      .select(`
        *,
        admin:responder_id (id, name)
      `)
      .eq('review_id', id)
      .order('created_at', { ascending: true });

    // Get moderation history
    const { data: moderationHistory } = await supabase
      .from('review_moderation_history')
      .select(`
        *,
        moderator:moderated_by (id, name)
      `)
      .eq('review_id', id)
      .order('created_at', { ascending: false });

    return {
      ...review,
      responses: responses || [],
      moderation_history: moderationHistory || [],
    };
  } catch (error) {
    logger.error('Get review by ID error:', error);
    throw error;
  }
}

/**
 * Create review (usually from customer, but can be created by admin)
 */
async function createReview(reviewData) {
  try {
    const reviewPayload = {
      booking_id: reviewData.booking_id || null,
      user_id: reviewData.user_id,
      partner_id: reviewData.partner_id || null,
      service_id: reviewData.service_id || null,
      rating: reviewData.rating,
      title: reviewData.title || null,
      comment: reviewData.comment || null,
      status: reviewData.status || 'pending',
      verified_purchase: reviewData.verified_purchase !== undefined ? reviewData.verified_purchase : true,
      display_name: reviewData.display_name || null,
      is_anonymous: reviewData.is_anonymous || false,
      images: reviewData.images || [],
      videos: reviewData.videos || [],
      categories: reviewData.categories || [],
      tags: reviewData.tags || [],
    };

    const { data, error } = await supabase
      .from('reviews')
      .insert([reviewPayload])
      .select(`
        *,
        user:user_id (id, name, phone_number)
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Create review error:', error);
    throw error;
  }
}

/**
 * Update review
 */
async function updateReview(id, updates) {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Update review error:', error);
    throw error;
  }
}

/**
 * Moderate review (approve/reject/hide)
 */
async function moderateReview(id, action, moderatedBy, notes = null) {
  try {
    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      hide: 'hidden',
      pending: 'pending',
    };

    const updates = {
      status: statusMap[action] || 'pending',
      moderated_by: moderatedBy,
      moderated_at: new Date().toISOString(),
      moderation_notes: notes,
    };

    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Moderate review error:', error);
    throw error;
  }
}

/**
 * Delete review (soft delete by hiding)
 */
async function deleteReview(id) {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .update({ status: 'hidden' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Delete review error:', error);
    throw error;
  }
}

// ============================================
// REVIEW RESPONSES
// ============================================

/**
 * Add response to review
 */
async function addReviewResponse(reviewId, responseData) {
  try {
    const responsePayload = {
      review_id: reviewId,
      parent_response_id: responseData.parent_response_id || null,
      responder_type: responseData.responder_type || 'admin',
      responder_id: responseData.responder_id,
      response_text: responseData.response_text,
    };

    const { data, error } = await supabase
      .from('review_responses')
      .insert([responsePayload])
      .select()
      .single();

    if (error) throw error;

    // Update admin_response on review if it's the first admin response
    if (responseData.responder_type === 'admin') {
      const { data: review } = await supabase
        .from('reviews')
        .select('admin_response')
        .eq('id', reviewId)
        .single();

      if (!review?.admin_response) {
        await supabase
          .from('reviews')
          .update({
            admin_response: responseData.response_text,
            admin_response_by: responseData.responder_id,
            admin_response_at: new Date().toISOString(),
          })
          .eq('id', reviewId);
      }
    }

    return data;
  } catch (error) {
    logger.error('Add review response error:', error);
    throw error;
  }
}

/**
 * Update response
 */
async function updateResponse(responseId, updates) {
  try {
    const { data, error } = await supabase
      .from('review_responses')
      .update({
        ...updates,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', responseId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Update response error:', error);
    throw error;
  }
}

/**
 * Delete response
 */
async function deleteResponse(responseId) {
  try {
    const { error } = await supabase
      .from('review_responses')
      .delete()
      .eq('id', responseId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    logger.error('Delete response error:', error);
    throw error;
  }
}

// ============================================
// REVIEW ANALYTICS
// ============================================

/**
 * Get rating breakdown
 */
async function getRatingBreakdown(filters = {}) {
  try {
    let query = supabase
      .from('reviews')
      .select('rating')
      .eq('status', 'approved');

    if (filters.service_id) {
      query = query.eq('service_id', filters.service_id);
    }
    if (filters.partner_id) {
      query = query.eq('partner_id', filters.partner_id);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    const { data, error } = await query;
    if (error) throw error;

    const breakdown = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    data?.forEach((review) => {
      if (review.rating >= 1 && review.rating <= 5) {
        breakdown[review.rating] = (breakdown[review.rating] || 0) + 1;
      }
    });

    const total = data?.length || 0;
    const percentages = {
      5: total > 0 ? Math.round((breakdown[5] / total) * 100) : 0,
      4: total > 0 ? Math.round((breakdown[4] / total) * 100) : 0,
      3: total > 0 ? Math.round((breakdown[3] / total) * 100) : 0,
      2: total > 0 ? Math.round((breakdown[2] / total) * 100) : 0,
      1: total > 0 ? Math.round((breakdown[1] / total) * 100) : 0,
    };

    return {
      breakdown,
      percentages,
      total,
    };
  } catch (error) {
    logger.error('Get rating breakdown error:', error);
    throw error;
  }
}

/**
 * Get feedback analysis (common complaints/praises)
 */
async function getFeedbackAnalysis(filters = {}) {
  try {
    let query = supabase
      .from('reviews')
      .select('comment, rating, categories, sentiment')
      .eq('status', 'approved')
      .not('comment', 'is', null);

    if (filters.service_id) {
      query = query.eq('service_id', filters.service_id);
    }
    if (filters.partner_id) {
      query = query.eq('partner_id', filters.partner_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Analyze sentiment if not already set
    const positiveReviews = data?.filter(r => r.rating >= 4) || [];
    const negativeReviews = data?.filter(r => r.rating <= 2) || [];

    // Extract common keywords/phrases
    const positiveKeywords = [];
    const negativeKeywords = [];

    positiveReviews.forEach((review) => {
      if (review.comment) {
        const words = review.comment.toLowerCase().split(/\s+/);
        words.forEach((word) => {
          if (word.length > 4) {
            positiveKeywords.push(word);
          }
        });
      }
    });

    negativeReviews.forEach((review) => {
      if (review.comment) {
        const words = review.comment.toLowerCase().split(/\s+/);
        words.forEach((word) => {
          if (word.length > 4) {
            negativeKeywords.push(word);
          }
        });
      }
    });

    return {
      total_reviews: data?.length || 0,
      positive_reviews: positiveReviews.length,
      negative_reviews: negativeReviews.length,
      neutral_reviews: data?.filter(r => r.rating === 3).length || 0,
      positive_keywords: getTopKeywords(positiveKeywords, 10),
      negative_keywords: getTopKeywords(negativeKeywords, 10),
    };
  } catch (error) {
    logger.error('Get feedback analysis error:', error);
    throw error;
  }
}

/**
 * Helper function to get top keywords
 */
function getTopKeywords(keywords, limit) {
  const frequency = {};
  keywords.forEach((word) => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Get reviews by service
 */
async function getReviewsByService(serviceId) {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user:user_id (id, name, phone_number),
        partner:partner_id (id, name)
      `)
      .eq('service_id', serviceId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Get reviews by service error:', error);
    throw error;
  }
}

/**
 * Get reviews by partner
 */
async function getReviewsByPartner(partnerId) {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user:user_id (id, name, phone_number),
        service:service_id (id, name),
        booking:booking_id (id, booking_number)
      `)
      .eq('partner_id', partnerId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Get reviews by partner error:', error);
    throw error;
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

