const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class PointsService {
  /**
   * Calculate points for a booking amount (1 point = ₹1)
   */
  calculatePointsForBooking(bookingAmount) {
    return Math.floor(bookingAmount);
  }

  /**
   * Award points to user (atomic operation using database function)
   */
  async awardPoints(userId, points, sourceType, sourceId, description) {
    try {
      const { data, error } = await supabase.rpc('add_points', {
        p_user_id: userId,
        p_points: points,
        p_source_type: sourceType,
        p_source_id: sourceId,
        p_description: description || `Points earned from ${sourceType}`
      });

      if (error) {
        logger.error('Error awarding points:', error);
        throw new Error(`Failed to award points: ${error.message}`);
      }

      return {
        success: true,
        newBalance: data,
        pointsAwarded: points
      };
    } catch (error) {
      logger.error('PointsService.awardPoints error:', error);
      throw error;
    }
  }

  /**
   * Redeem points (atomic operation using database function)
   */
  async redeemPoints(userId, pointsToRedeem) {
    try {
      // Validate points is multiple of 100
      if (pointsToRedeem < 100 || pointsToRedeem % 100 !== 0) {
        throw new Error('Points must be a multiple of 100 (minimum 100 points)');
      }

      const { data, error } = await supabase.rpc('redeem_points', {
        p_user_id: userId,
        p_points_to_redeem: pointsToRedeem
      });

      if (error) {
        logger.error('Error redeeming points:', error);
        throw new Error(`Failed to redeem points: ${error.message}`);
      }

      const discountAmount = parseFloat(data);

      return {
        success: true,
        pointsUsed: pointsToRedeem,
        discountAmount: discountAmount,
        newBalance: await this.getBalance(userId).then(b => b.points_balance)
      };
    } catch (error) {
      logger.error('PointsService.redeemPoints error:', error);
      throw error;
    }
  }

  /**
   * Get user points balance and tier info
   */
  async getBalance(userId) {
    try {
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If user_points doesn't exist, create it
        if (error.code === 'PGRST116') {
          const { data: newData, error: insertError } = await supabase
            .from('user_points')
            .insert({
              user_id: userId,
              points_balance: 0,
              lifetime_points_earned: 0,
              lifetime_points_redeemed: 0,
              current_tier: 'bronze'
            })
            .select()
            .single();

          if (insertError) {
            throw new Error(`Failed to create user points: ${insertError.message}`);
          }

          return await this.getBalanceWithTierInfo(newData);
        }
        throw new Error(`Failed to get balance: ${error.message}`);
      }

      return await this.getBalanceWithTierInfo(data);
    } catch (error) {
      logger.error('PointsService.getBalance error:', error);
      throw error;
    }
  }

  /**
   * Get balance with tier information
   */
  async getBalanceWithTierInfo(userPoints) {
    try {
      // Get current tier info
      const { data: tierData, error: tierError } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .eq('tier_name', userPoints.current_tier)
        .single();

      if (tierError) {
        logger.warn('Tier not found, using default');
      }

      // Get next tier info
      const { data: nextTierData } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .gt('min_points', userPoints.lifetime_points_earned)
        .eq('is_active', true)
        .order('min_points', { ascending: true })
        .limit(1)
        .single();

      const pointsToNextTier = nextTierData 
        ? Math.max(0, nextTierData.min_points - userPoints.lifetime_points_earned)
        : null;

      return {
        points_balance: userPoints.points_balance,
        lifetime_points_earned: userPoints.lifetime_points_earned,
        lifetime_points_redeemed: userPoints.lifetime_points_redeemed,
        current_tier: userPoints.current_tier,
        tier_info: tierData ? {
          tier_name: tierData.tier_name,
          cashback_percentage: parseFloat(tierData.cashback_percentage),
          benefits: tierData.benefits || [],
          badge_color: tierData.badge_color,
          badge_icon: tierData.badge_icon
        } : null,
        next_tier: nextTierData ? {
          tier_name: nextTierData.tier_name,
          min_points: nextTierData.min_points,
          points_to_next_tier: pointsToNextTier
        } : null,
        can_redeem: userPoints.points_balance >= 100,
        redemption_rate: 10 // 100 points = ₹10
      };
    } catch (error) {
      logger.error('PointsService.getBalanceWithTierInfo error:', error);
      throw error;
    }
  }

  /**
   * Get points transaction history
   */
  async getHistory(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        type = null,
        startDate = null,
        endDate = null
      } = options;

      let query = supabase
        .from('points_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('transaction_type', type);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw new Error(`Failed to get history: ${error.message}`);
      }

      return {
        transactions: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      };
    } catch (error) {
      logger.error('PointsService.getHistory error:', error);
      throw error;
    }
  }

  /**
   * Create redemption record
   */
  async createRedemption(userId, pointsUsed, discountAmount, redemptionType = 'discount_voucher', bookingId = null) {
    try {
      // Generate voucher code if needed
      const voucherCode = redemptionType === 'discount_voucher' 
        ? `LOYALTY${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
        : null;

      // Check if voucher code is unique
      if (voucherCode) {
        const { data: existing } = await supabase
          .from('points_redemptions')
          .select('id')
          .eq('voucher_code', voucherCode)
          .single();

        if (existing) {
          // Retry with new code
          return this.createRedemption(userId, pointsUsed, discountAmount, redemptionType, bookingId);
        }
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

      const { data, error } = await supabase
        .from('points_redemptions')
        .insert({
          user_id: userId,
          points_used: pointsUsed,
          discount_amount: discountAmount,
          redemption_type: redemptionType,
          status: bookingId ? 'applied' : 'pending',
          booking_id: bookingId,
          voucher_code: voucherCode,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create redemption: ${error.message}`);
      }

      return data;
    } catch (error) {
      logger.error('PointsService.createRedemption error:', error);
      throw error;
    }
  }

  /**
   * Apply redemption to booking
   */
  async applyRedemption(redemptionId, bookingId) {
    try {
      const { data, error } = await supabase
        .from('points_redemptions')
        .update({
          status: 'applied',
          booking_id: bookingId,
          applied_at: new Date().toISOString()
        })
        .eq('id', redemptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to apply redemption: ${error.message}`);
      }

      return data;
    } catch (error) {
      logger.error('PointsService.applyRedemption error:', error);
      throw error;
    }
  }

  /**
   * Get all tiers information
   */
  async getTiers() {
    try {
      const { data, error } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .eq('is_active', true)
        .order('min_points', { ascending: true });

      if (error) {
        throw new Error(`Failed to get tiers: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('PointsService.getTiers error:', error);
      throw error;
    }
  }

  /**
   * Calculate tier progress for user
   */
  async getTierProgress(userId) {
    try {
      const balance = await this.getBalance(userId);
      const tiers = await this.getTiers();

      const currentTierIndex = tiers.findIndex(t => t.tier_name === balance.current_tier);
      const nextTier = tiers[currentTierIndex + 1];

      if (!nextTier) {
        return {
          current_tier: balance.current_tier,
          is_max_tier: true,
          progress_percentage: 100
        };
      }

      const currentPoints = balance.lifetime_points_earned;
      const nextTierPoints = nextTier.min_points;
      const currentTierPoints = tiers[currentTierIndex].min_points;
      const pointsRange = nextTierPoints - currentTierPoints;
      const pointsProgress = currentPoints - currentTierPoints;
      const progressPercentage = Math.min(100, (pointsProgress / pointsRange) * 100);

      return {
        current_tier: balance.current_tier,
        current_points: currentPoints,
        next_tier: nextTier.tier_name,
        next_tier_points: nextTierPoints,
        points_to_next_tier: Math.max(0, nextTierPoints - currentPoints),
        progress_percentage: Math.round(progressPercentage)
      };
    } catch (error) {
      logger.error('PointsService.getTierProgress error:', error);
      throw error;
    }
  }
}

module.exports = new PointsService();

