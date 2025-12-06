const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Marketing & Promotions Service
 * Comprehensive service for managing all marketing activities
 */

// ============================================
// PROMO CODE MANAGEMENT
// ============================================

/**
 * Get all promo codes with filters
 */
async function getAllPromoCodes(filters = {}) {
  try {
    let query = supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.promo_type) {
      query = query.eq('promo_type', filters.promo_type);
    }
    if (filters.search) {
      query = query.or(`code.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get usage stats for each promo
    const promosWithStats = await Promise.all(
      data.map(async (promo) => {
        const { count: usageCount } = await supabase
          .from('promo_code_usage')
          .select('*', { count: 'exact', head: true })
          .eq('promo_code_id', promo.id);

        return {
          ...promo,
          usage_count: promo.used_count || 0,
          usage_details: {
            total_uses: usageCount || 0,
            remaining_uses: promo.total_usage_limit
              ? Math.max(0, promo.total_usage_limit - (usageCount || 0))
              : null,
          },
        };
      })
    );

    return promosWithStats;
  } catch (error) {
    logger.error('Get all promo codes error:', error);
    throw error;
  }
}

/**
 * Get promo code by ID
 */
async function getPromoCodeById(id) {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Get promo code by ID error:', error);
    throw error;
  }
}

/**
 * Create new promo code
 */
async function createPromoCode(promoData) {
  try {
    // Validate code uniqueness
    const { data: existing } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('code', promoData.code.toUpperCase())
      .single();

    if (existing) {
      throw new Error('Promo code already exists');
    }

    const promoPayload = {
      code: promoData.code.toUpperCase().trim(),
      discount_type: promoData.discount_type,
      discount_value: promoData.discount_value,
      min_order_amount: promoData.min_order_amount || null,
      max_discount: promoData.max_discount || null,
      total_usage_limit: promoData.total_usage_limit || null,
      usage_limit_per_user: promoData.usage_limit_per_user || 1,
      valid_from: promoData.valid_from || null,
      valid_until: promoData.valid_until || null,
      promo_type: promoData.promo_type || 'general',
      first_time_only: promoData.first_time_only || false,
      applicable_services: promoData.applicable_services || [],
      applicable_categories: promoData.applicable_categories || [],
      description: promoData.description || null,
      is_active: promoData.is_active !== undefined ? promoData.is_active : true,
      created_by: promoData.created_by || null,
      metadata: promoData.metadata || {},
    };

    const { data, error } = await supabase
      .from('promo_codes')
      .insert([promoPayload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Create promo code error:', error);
    throw error;
  }
}

/**
 * Update promo code
 */
async function updatePromoCode(id, updates) {
  try {
    // If code is being updated, check uniqueness
    if (updates.code) {
      const { data: existing } = await supabase
        .from('promo_codes')
        .select('id')
        .eq('code', updates.code.toUpperCase())
        .neq('id', id)
        .single();

      if (existing) {
        throw new Error('Promo code already exists');
      }
      updates.code = updates.code.toUpperCase().trim();
    }

    const { data, error } = await supabase
      .from('promo_codes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Update promo code error:', error);
    throw error;
  }
}

/**
 * Delete promo code (soft delete by setting is_active to false)
 */
async function deletePromoCode(id) {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Delete promo code error:', error);
    throw error;
  }
}

/**
 * Get promo code usage history
 */
async function getPromoCodeUsage(promoCodeId, filters = {}) {
  try {
    let query = supabase
      .from('promo_code_usage')
      .select(`
        *,
        users:user_id (id, name, phone_number),
        bookings:booking_id (id, booking_number, grand_total)
      `)
      .eq('promo_code_id', promoCodeId)
      .order('used_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Get promo code usage error:', error);
    throw error;
  }
}

// ============================================
// CAMPAIGNS MANAGEMENT
// ============================================

/**
 * Get all campaigns
 */
async function getAllCampaigns(filters = {}) {
  try {
    let query = supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.campaign_type) {
      query = query.eq('campaign_type', filters.campaign_type);
    }
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Get all campaigns error:', error);
    throw error;
  }
}

/**
 * Create campaign
 */
async function createCampaign(campaignData) {
  try {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .insert([campaignData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Create campaign error:', error);
    throw error;
  }
}

/**
 * Update campaign
 */
async function updateCampaign(id, updates) {
  try {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Update campaign error:', error);
    throw error;
  }
}

/**
 * Get campaign analytics
 */
async function getCampaignAnalytics(campaignId, dateFrom = null, dateTo = null) {
  try {
    let query = supabase
      .from('campaign_analytics')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('date', { ascending: false });

    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Calculate totals
    const totals = data.reduce(
      (acc, day) => ({
        impressions: acc.impressions + (day.impressions || 0),
        clicks: acc.clicks + (day.clicks || 0),
        conversions: acc.conversions + (day.conversions || 0),
        revenue: acc.revenue + parseFloat(day.revenue || 0),
        cost: acc.cost + parseFloat(day.cost || 0),
      }),
      { impressions: 0, clicks: 0, conversions: 0, revenue: 0, cost: 0 }
    );

    totals.conversion_rate =
      totals.impressions > 0 ? (totals.conversions / totals.impressions) * 100 : 0;
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

    return {
      daily_data: data,
      totals,
    };
  } catch (error) {
    logger.error('Get campaign analytics error:', error);
    throw error;
  }
}

// ============================================
// BANNERS MANAGEMENT
// ============================================

/**
 * Get all banners
 */
async function getAllBanners(filters = {}) {
  try {
    let query = supabase
      .from('banners')
      .select('*')
      .order('priority', { ascending: false });

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.position) {
      query = query.eq('position', filters.position);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Get all banners error:', error);
    throw error;
  }
}

/**
 * Get active banners for frontend
 */
async function getActiveBanners(position = null) {
  try {
    const now = new Date().toISOString();
    let query = supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .or(`valid_from.is.null,valid_from.lte.${now}`)
      .or(`valid_until.is.null,valid_until.gte.${now}`)
      .order('priority', { ascending: false });

    if (position) {
      query = query.eq('position', position);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Get active banners error:', error);
    throw error;
  }
}

/**
 * Create banner
 */
async function createBanner(bannerData) {
  try {
    const { data, error } = await supabase
      .from('banners')
      .insert([bannerData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Create banner error:', error);
    throw error;
  }
}

/**
 * Update banner
 */
async function updateBanner(id, updates) {
  try {
    const { data, error } = await supabase
      .from('banners')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Update banner error:', error);
    throw error;
  }
}

/**
 * Track banner impression
 */
async function trackBannerImpression(bannerId) {
  try {
    const { error } = await supabase.rpc('increment_banner_impression', {
      banner_id: bannerId,
    });

    if (error) {
      // Fallback: manual update if RPC doesn't exist
      const { data: banner } = await supabase
        .from('banners')
        .select('impression_count')
        .eq('id', bannerId)
        .single();

      if (banner) {
        await supabase
          .from('banners')
          .update({ impression_count: (banner.impression_count || 0) + 1 })
          .eq('id', bannerId);
      }
    }
  } catch (error) {
    logger.error('Track banner impression error:', error);
    // Don't throw - tracking should not break the flow
  }
}

/**
 * Track banner click
 */
async function trackBannerClick(bannerId) {
  try {
    const { error } = await supabase.rpc('increment_banner_click', {
      banner_id: bannerId,
    });

    if (error) {
      // Fallback: manual update
      const { data: banner } = await supabase
        .from('banners')
        .select('click_count')
        .eq('id', bannerId)
        .single();

      if (banner) {
        await supabase
          .from('banners')
          .update({ click_count: (banner.click_count || 0) + 1 })
          .eq('id', bannerId);
      }
    }
  } catch (error) {
    logger.error('Track banner click error:', error);
    // Don't throw - tracking should not break the flow
  }
}

// ============================================
// NOTIFICATIONS MANAGEMENT
// ============================================

/**
 * Get all notifications
 */
async function getAllNotifications(filters = {}) {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.notification_type) {
      query = query.eq('notification_type', filters.notification_type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Get all notifications error:', error);
    throw error;
  }
}

/**
 * Create notification
 */
async function createNotification(notificationData) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Create notification error:', error);
    throw error;
  }
}

/**
 * Get notification stats
 */
async function getNotificationStats(notificationId) {
  try {
    const { count: total } = await supabase
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('notification_id', notificationId);

    const { count: delivered } = await supabase
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('notification_id', notificationId)
      .eq('status', 'delivered');

    const { count: opened } = await supabase
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('notification_id', notificationId)
      .eq('status', 'opened');

    const { count: clicked } = await supabase
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('notification_id', notificationId)
      .eq('status', 'clicked');

    return {
      total_recipients: total || 0,
      delivered: delivered || 0,
      opened: opened || 0,
      clicked: clicked || 0,
      delivery_rate: total > 0 ? ((delivered || 0) / total) * 100 : 0,
      open_rate: delivered > 0 ? ((opened || 0) / delivered) * 100 : 0,
      click_rate: opened > 0 ? ((clicked || 0) / opened) * 100 : 0,
    };
  } catch (error) {
    logger.error('Get notification stats error:', error);
    throw error;
  }
}

// ============================================
// REFERRAL MANAGEMENT
// ============================================

/**
 * Get all referrals
 */
async function getAllReferrals(filters = {}) {
  try {
    let query = supabase
      .from('referrals')
      .select(`
        *,
        referrer:referrer_user_id (id, name, phone_number),
        referred:referred_user_id (id, name, phone_number)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.referrer_user_id) {
      query = query.eq('referrer_user_id', filters.referrer_user_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Get all referrals error:', error);
    throw error;
  }
}

/**
 * Get referral stats
 */
async function getReferralStats() {
  try {
    const { count: total } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true });

    const { count: completed } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    const { count: rewarded } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rewarded');

    // Get total reward points given
    const { data: referrals } = await supabase
      .from('referrals')
      .select('referrer_reward_points, referred_reward_points')
      .eq('status', 'rewarded');

    const totalRewardPoints = referrals?.reduce(
      (sum, r) => sum + (r.referrer_reward_points || 0) + (r.referred_reward_points || 0),
      0
    ) || 0;

    return {
      total_referrals: total || 0,
      completed_referrals: completed || 0,
      rewarded_referrals: rewarded || 0,
      conversion_rate: total > 0 ? ((completed || 0) / total) * 100 : 0,
      total_reward_points_given: totalRewardPoints,
    };
  } catch (error) {
    logger.error('Get referral stats error:', error);
    throw error;
  }
}

module.exports = {
  // Promo codes
  getAllPromoCodes,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  getPromoCodeUsage,
  // Campaigns
  getAllCampaigns,
  createCampaign,
  updateCampaign,
  getCampaignAnalytics,
  // Banners
  getAllBanners,
  getActiveBanners,
  createBanner,
  updateBanner,
  trackBannerImpression,
  trackBannerClick,
  // Notifications
  getAllNotifications,
  createNotification,
  getNotificationStats,
  // Referrals
  getAllReferrals,
  getReferralStats,
};

