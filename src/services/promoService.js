const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Validate and calculate promo code discount
 */
async function validatePromoCode(code, orderAmount, userId = null) {
  try {
    if (!code) {
      return { valid: false, discount: 0 };
    }

    const upperCode = code.toUpperCase().trim();

    // Get promo code
    const { data: promo, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', upperCode)
      .eq('is_active', true)
      .single();

    if (error || !promo) {
      return { valid: false, discount: 0, message: 'Invalid promo code' };
    }

    const now = new Date();
    const validFrom = promo.valid_from ? new Date(promo.valid_from) : null;
    const validUntil = promo.valid_until ? new Date(promo.valid_until) : null;

    // Check validity dates
    if (validFrom && now < validFrom) {
      return { valid: false, discount: 0, message: 'Promo code not yet valid' };
    }

    if (validUntil && now > validUntil) {
      return { valid: false, discount: 0, message: 'Promo code expired' };
    }

    // Check minimum order amount
    if (promo.min_order_amount && orderAmount < parseFloat(promo.min_order_amount)) {
      return {
        valid: false,
        discount: 0,
        message: `Minimum order amount is ₹${promo.min_order_amount}`
      };
    }

    // Check usage limit per user
    if (userId && promo.usage_limit_per_user) {
      const { count: userUsageCount } = await supabase
        .from('promo_code_usage')
        .select('*', { count: 'exact', head: true })
        .eq('promo_code_id', promo.id)
        .eq('user_id', userId);

      if (userUsageCount >= promo.usage_limit_per_user) {
        return {
          valid: false,
          discount: 0,
          message: 'You have already used this promo code'
        };
      }
    }

    // Check first-time only restriction
    if (promo.first_time_only && userId) {
      const { count: userBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['completed', 'confirmed']);

      if (userBookings > 0) {
        return {
          valid: false,
          discount: 0,
          message: 'This promo code is only valid for first-time users'
        };
      }
    }

    // Check total usage limit - Use actual count from promo_code_usage for accuracy
    if (promo.total_usage_limit) {
      // Get actual usage count from promo_code_usage table for accurate check
      const { count: actualUsageCount } = await supabase
        .from('promo_code_usage')
        .select('*', { count: 'exact', head: true })
        .eq('promo_code_id', promo.id);

      if ((actualUsageCount || 0) >= promo.total_usage_limit) {
      return { valid: false, discount: 0, message: 'Promo code usage limit reached' };
      }
    }

    // Calculate discount
    let discount = 0;
    if (promo.discount_type === 'percentage') {
      discount = (orderAmount * parseFloat(promo.discount_value)) / 100;
    } else {
      discount = parseFloat(promo.discount_value);
    }

    // Apply max discount if specified
    if (promo.max_discount && discount > parseFloat(promo.max_discount)) {
      discount = parseFloat(promo.max_discount);
    }

    return {
      valid: true,
      discount: Math.floor(discount * 100) / 100, // Round to 2 decimals
      promo_code: promo.code,
      promo_code_id: promo.id, // Include ID for usage recording
      discount_type: promo.discount_type,
      discount_value: promo.discount_value
    };
  } catch (error) {
    logger.error('Validate promo code error:', error);
    return { valid: false, discount: 0, message: 'Error validating promo code' };
  }
}

/**
 * Record promo code usage after successful booking
 */
async function recordPromoCodeUsage(promoCodeId, userId, bookingId, discountAmount, orderAmount) {
  try {
    const { data, error } = await supabase
      .from('promo_code_usage')
      .insert([
        {
          promo_code_id: promoCodeId,
          user_id: userId,
          booking_id: bookingId,
          discount_amount: discountAmount,
          order_amount: orderAmount,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Record promo code usage error:', error);
    throw error;
  }
}

module.exports = {
  validatePromoCode,
  recordPromoCodeUsage
};

