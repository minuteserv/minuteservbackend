const { successResponse, errorResponse } = require('../../utils/response');
const marketingService = require('../../services/marketingService');
const promoReconciliationService = require('../../services/promoReconciliationService');
const logger = require('../../utils/logger');

// ============================================
// PROMO CODES CONTROLLERS
// ============================================

/**
 * Get all promo codes
 */
async function getAllPromoCodes(req, res) {
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      promo_type: req.query.promo_type,
      search: req.query.search,
    };

    const promoCodes = await marketingService.getAllPromoCodes(filters);
    return successResponse(res, promoCodes);
  } catch (error) {
    logger.error('Get all promo codes error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get promo code by ID
 */
async function getPromoCodeById(req, res) {
  try {
    const { id } = req.params;
    const promoCode = await marketingService.getPromoCodeById(id);

    if (!promoCode) {
      return errorResponse(res, { message: 'Promo code not found' }, 404);
    }

    // Get usage history
    const usage = await marketingService.getPromoCodeUsage(id, { limit: 50 });

    return successResponse(res, {
      ...promoCode,
      usage_history: usage,
    });
  } catch (error) {
    logger.error('Get promo code by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create promo code
 */
async function createPromoCode(req, res) {
  try {
    const promoData = {
      ...req.body,
      created_by: req.admin?.id,
    };

    const promoCode = await marketingService.createPromoCode(promoData);
    return successResponse(res, promoCode, 'Promo code created successfully', 201);
  } catch (error) {
    logger.error('Create promo code error:', error);
    const message = error.message || 'Failed to create promo code';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Update promo code
 */
async function updatePromoCode(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const promoCode = await marketingService.updatePromoCode(id, updates);
    return successResponse(res, promoCode, 'Promo code updated successfully');
  } catch (error) {
    logger.error('Update promo code error:', error);
    const message = error.message || 'Failed to update promo code';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Delete promo code
 */
async function deletePromoCode(req, res) {
  try {
    const { id } = req.params;
    await marketingService.deletePromoCode(id);
    return successResponse(res, null, 'Promo code deleted successfully');
  } catch (error) {
    logger.error('Delete promo code error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// CAMPAIGNS CONTROLLERS
// ============================================

/**
 * Get all campaigns
 */
async function getAllCampaigns(req, res) {
  try {
    const filters = {
      status: req.query.status,
      campaign_type: req.query.campaign_type,
      search: req.query.search,
    };

    const campaigns = await marketingService.getAllCampaigns(filters);
    return successResponse(res, campaigns);
  } catch (error) {
    logger.error('Get all campaigns error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get campaign by ID
 */
async function getCampaignById(req, res) {
  try {
    const { id } = req.params;
    const campaigns = await marketingService.getAllCampaigns({});
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return errorResponse(res, { message: 'Campaign not found' }, 404);
    }

    // Get analytics
    const analytics = await marketingService.getCampaignAnalytics(
      id,
      req.query.date_from,
      req.query.date_to
    );

    return successResponse(res, {
      ...campaign,
      analytics,
    });
  } catch (error) {
    logger.error('Get campaign by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create campaign
 */
async function createCampaign(req, res) {
  try {
    const campaignData = {
      ...req.body,
      created_by: req.admin?.id,
    };

    const campaign = await marketingService.createCampaign(campaignData);
    return successResponse(res, campaign, 'Campaign created successfully', 201);
  } catch (error) {
    logger.error('Create campaign error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update campaign
 */
async function updateCampaign(req, res) {
  try {
    const { id } = req.params;
    const campaign = await marketingService.updateCampaign(id, req.body);
    return successResponse(res, campaign, 'Campaign updated successfully');
  } catch (error) {
    logger.error('Update campaign error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// BANNERS CONTROLLERS
// ============================================

/**
 * Get all banners
 */
async function getAllBanners(req, res) {
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      position: req.query.position,
    };

    const banners = await marketingService.getAllBanners(filters);
    return successResponse(res, banners);
  } catch (error) {
    logger.error('Get all banners error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get active banners (for frontend)
 */
async function getActiveBanners(req, res) {
  try {
    const position = req.query.position;
    const banners = await marketingService.getActiveBanners(position);
    return successResponse(res, banners);
  } catch (error) {
    logger.error('Get active banners error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create banner
 */
async function createBanner(req, res) {
  try {
    const bannerData = {
      ...req.body,
      created_by: req.admin?.id,
    };

    const banner = await marketingService.createBanner(bannerData);
    return successResponse(res, banner, 'Banner created successfully', 201);
  } catch (error) {
    logger.error('Create banner error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update banner
 */
async function updateBanner(req, res) {
  try {
    const { id } = req.params;
    const banner = await marketingService.updateBanner(id, req.body);
    return successResponse(res, banner, 'Banner updated successfully');
  } catch (error) {
    logger.error('Update banner error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Delete banner
 */
async function deleteBanner(req, res) {
  try {
    const { id } = req.params;
    await marketingService.updateBanner(id, { is_active: false });
    return successResponse(res, null, 'Banner deleted successfully');
  } catch (error) {
    logger.error('Delete banner error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// NOTIFICATIONS CONTROLLERS
// ============================================

/**
 * Get all notifications
 */
async function getAllNotifications(req, res) {
  try {
    const filters = {
      status: req.query.status,
      notification_type: req.query.notification_type,
    };

    const notifications = await marketingService.getAllNotifications(filters);
    return successResponse(res, notifications);
  } catch (error) {
    logger.error('Get all notifications error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get notification by ID
 */
async function getNotificationById(req, res) {
  try {
    const { id } = req.params;
    const notifications = await marketingService.getAllNotifications({});
    const notification = notifications.find((n) => n.id === id);

    if (!notification) {
      return errorResponse(res, { message: 'Notification not found' }, 404);
    }

    // Get stats
    const stats = await marketingService.getNotificationStats(id);

    return successResponse(res, {
      ...notification,
      stats,
    });
  } catch (error) {
    logger.error('Get notification by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create notification
 */
async function createNotification(req, res) {
  try {
    const notificationData = {
      ...req.body,
      created_by: req.admin?.id,
    };

    const notification = await marketingService.createNotification(notificationData);
    return successResponse(res, notification, 'Notification created successfully', 201);
  } catch (error) {
    logger.error('Create notification error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// REFERRALS CONTROLLERS
// ============================================

/**
 * Get all referrals
 */
async function getAllReferrals(req, res) {
  try {
    const filters = {
      status: req.query.status,
      referrer_user_id: req.query.referrer_user_id,
    };

    const referrals = await marketingService.getAllReferrals(filters);
    return successResponse(res, referrals);
  } catch (error) {
    logger.error('Get all referrals error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get referral stats
 */
async function getReferralStats(req, res) {
  try {
    const stats = await marketingService.getReferralStats();
    return successResponse(res, stats);
  } catch (error) {
    logger.error('Get referral stats error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// MARKETING DASHBOARD
// ============================================

/**
 * Reconcile promo code usage counts
 */
async function reconcilePromoCodeUsage(req, res) {
  try {
    const { promo_code_id } = req.query;
    
    if (promo_code_id) {
      // Reconcile single promo code
      const result = await promoReconciliationService.reconcileSinglePromoCode(promo_code_id);
      return successResponse(res, result, 'Promo code usage reconciled');
    } else {
      // Reconcile all promo codes
      const result = await promoReconciliationService.reconcilePromoCodeUsage();
      return successResponse(res, result, 'All promo codes usage reconciled');
    }
  } catch (error) {
    logger.error('Reconcile promo code usage error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get marketing dashboard stats
 */
async function getMarketingDashboard(req, res) {
  try {
    const [
      activePromoCodes,
      activeCampaigns,
      activeBanners,
      referralStats,
    ] = await Promise.all([
      marketingService.getAllPromoCodes({ is_active: true }),
      marketingService.getAllCampaigns({ status: 'active' }),
      marketingService.getAllBanners({ is_active: true }),
      marketingService.getReferralStats(),
    ]);

    return successResponse(res, {
      promo_codes: {
        total: activePromoCodes.length,
        active: activePromoCodes.length,
      },
      campaigns: {
        total: activeCampaigns.length,
        active: activeCampaigns.length,
      },
      banners: {
        total: activeBanners.length,
        active: activeBanners.length,
      },
      referrals: referralStats,
    });
  } catch (error) {
    logger.error('Get marketing dashboard error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  // Promo codes
  getAllPromoCodes,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  // Campaigns
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  // Banners
  getAllBanners,
  getActiveBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  // Notifications
  getAllNotifications,
  getNotificationById,
  createNotification,
  // Referrals
  getAllReferrals,
  getReferralStats,
  // Dashboard
  getMarketingDashboard,
  // Reconciliation
  reconcilePromoCodeUsage,
};

