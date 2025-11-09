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

    // Check usage limit (per user)
    if (promo.usage_limit && userId) {
      // TODO: Check user's usage count from promo_code_usage table
      // For now, skip this check
    }

    // Check total usage limit
    if (promo.total_usage_limit && promo.used_count >= promo.total_usage_limit) {
      return { valid: false, discount: 0, message: 'Promo code usage limit reached' };
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
      discount_type: promo.discount_type,
      discount_value: promo.discount_value
    };
  } catch (error) {
    logger.error('Validate promo code error:', error);
    return { valid: false, discount: 0, message: 'Error validating promo code' };
  }
}

module.exports = {
  validatePromoCode
};

