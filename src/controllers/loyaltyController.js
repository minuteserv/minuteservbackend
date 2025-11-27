const pointsService = require('../services/pointsService');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get user points balance and tier information
 * GET /api/v1/loyalty/balance
 */
async function getBalance(req, res) {
  try {
    const userId = req.user.id;

    const balance = await pointsService.getBalance(userId);

    return successResponse(res, balance, 'Points balance retrieved successfully');
  } catch (error) {
    logger.error('getBalance error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get points transaction history
 * GET /api/v1/loyalty/history
 */
async function getHistory(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      type = null,
      start_date = null,
      end_date = null
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      type: type || null,
      startDate: start_date || null,
      endDate: end_date || null
    };

    const history = await pointsService.getHistory(userId, options);

    return successResponse(res, history, 'Transaction history retrieved successfully');
  } catch (error) {
    logger.error('getHistory error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Redeem points for discount
 * POST /api/v1/loyalty/redeem
 */
async function redeemPoints(req, res) {
  try {
    const userId = req.user.id;
    const { points_to_redeem, redemption_type = 'discount_voucher', booking_id = null } = req.body;

    // Validate input
    if (!points_to_redeem || points_to_redeem < 100) {
      return errorResponse(res, { message: 'Points must be at least 100' }, 400);
    }

    if (points_to_redeem % 100 !== 0) {
      return errorResponse(res, { message: 'Points must be a multiple of 100' }, 400);
    }

    // Redeem points
    const redemptionResult = await pointsService.redeemPoints(userId, points_to_redeem);

    // Create redemption record
    const redemption = await pointsService.createRedemption(
      userId,
      redemptionResult.pointsUsed,
      redemptionResult.discountAmount,
      redemption_type,
      booking_id
    );

    return successResponse(res, {
      redemption_id: redemption.id,
      points_used: redemptionResult.pointsUsed,
      discount_amount: redemptionResult.discountAmount,
      voucher_code: redemption.voucher_code,
      new_balance: redemptionResult.newBalance,
      expires_at: redemption.expires_at
    }, 'Points redeemed successfully');
  } catch (error) {
    logger.error('redeemPoints error:', error);
    return errorResponse(res, error, 400);
  }
}

/**
 * Apply redemption to booking
 * POST /api/v1/loyalty/apply-redemption
 */
async function applyRedemption(req, res) {
  try {
    const userId = req.user.id;
    const { redemption_id, booking_id } = req.body;

    if (!redemption_id || !booking_id) {
      return errorResponse(res, { message: 'Redemption ID and Booking ID are required' }, 400);
    }

    // Verify redemption belongs to user
    const { supabase } = require('../config/supabase');
    const { data: redemption, error } = await supabase
      .from('points_redemptions')
      .select('*')
      .eq('id', redemption_id)
      .eq('user_id', userId)
      .single();

    if (error || !redemption) {
      return errorResponse(res, { message: 'Redemption not found' }, 404);
    }

    if (redemption.status !== 'pending') {
      return errorResponse(res, { message: 'Redemption already applied or expired' }, 400);
    }

    // Apply redemption
    const appliedRedemption = await pointsService.applyRedemption(redemption_id, booking_id);

    return successResponse(res, {
      redemption_id: appliedRedemption.id,
      discount_applied: parseFloat(appliedRedemption.discount_amount),
      status: appliedRedemption.status
    }, 'Redemption applied successfully');
  } catch (error) {
    logger.error('applyRedemption error:', error);
    return errorResponse(res, error, 400);
  }
}

/**
 * Get all loyalty tiers information
 * GET /api/v1/loyalty/tiers
 */
async function getTiers(req, res) {
  try {
    const userId = req.user?.id;
    const tiers = await pointsService.getTiers();

    let progress = null;
    if (userId) {
      progress = await pointsService.getTierProgress(userId);
    }

    return successResponse(res, {
      tiers: tiers.map(tier => ({
        tier_name: tier.tier_name,
        min_points: tier.min_points,
        max_points: tier.max_points,
        cashback_percentage: parseFloat(tier.cashback_percentage),
        benefits: tier.benefits || [],
        badge_color: tier.badge_color,
        badge_icon: tier.badge_icon
      })),
      current_tier: progress?.current_tier || null,
      progress: progress || null
    }, 'Tiers retrieved successfully');
  } catch (error) {
    logger.error('getTiers error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getBalance,
  getHistory,
  redeemPoints,
  applyRedemption,
  getTiers
};

