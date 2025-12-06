const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Reconcile promo code used_count with actual usage from promo_code_usage table
 * This fixes any data mismatches between the counter and actual usage
 */
async function reconcilePromoCodeUsage() {
  try {
    logger.info('Starting promo code usage reconciliation...');

    // Get all promo codes
    const { data: promoCodes, error: promoCodesError } = await supabase
      .from('promo_codes')
      .select('id, code, used_count');

    if (promoCodesError) {
      throw promoCodesError;
    }

    let updatedCount = 0;
    const updates = [];

    // For each promo code, count actual usage
    for (const promo of promoCodes || []) {
      const { count: actualUsageCount } = await supabase
        .from('promo_code_usage')
        .select('*', { count: 'exact', head: true })
        .eq('promo_code_id', promo.id);

      const actualCount = actualUsageCount || 0;
      const currentCount = promo.used_count || 0;

      // If counts don't match, update
      if (actualCount !== currentCount) {
        updates.push({
          id: promo.id,
          code: promo.code,
          oldCount: currentCount,
          newCount: actualCount,
        });

        await supabase
          .from('promo_codes')
          .update({ used_count: actualCount })
          .eq('id', promo.id);

        updatedCount++;
        logger.info(
          `Updated promo code ${promo.code}: ${currentCount} → ${actualCount}`
        );
      }
    }

    logger.info(
      `Reconciliation complete. Updated ${updatedCount} promo code(s).`
    );

    return {
      success: true,
      total_promo_codes: promoCodes?.length || 0,
      updated_count: updatedCount,
      updates,
    };
  } catch (error) {
    logger.error('Reconciliation error:', error);
    throw error;
  }
}

/**
 * Reconcile a specific promo code
 */
async function reconcileSinglePromoCode(promoCodeId) {
  try {
    // Get promo code
    const { data: promo, error: promoError } = await supabase
      .from('promo_codes')
      .select('id, code, used_count')
      .eq('id', promoCodeId)
      .single();

    if (promoError || !promo) {
      throw new Error('Promo code not found');
    }

    // Get actual usage count
    const { count: actualUsageCount } = await supabase
      .from('promo_code_usage')
      .select('*', { count: 'exact', head: true })
      .eq('promo_code_id', promoCodeId);

    const actualCount = actualUsageCount || 0;
    const currentCount = promo.used_count || 0;

    // Update if different
    if (actualCount !== currentCount) {
      await supabase
        .from('promo_codes')
        .update({ used_count: actualCount })
        .eq('id', promoCodeId);

      logger.info(
        `Reconciled promo code ${promo.code}: ${currentCount} → ${actualCount}`
      );

      return {
        success: true,
        promo_code: promo.code,
        old_count: currentCount,
        new_count: actualCount,
        updated: true,
      };
    }

    return {
      success: true,
      promo_code: promo.code,
      old_count: currentCount,
      new_count: actualCount,
      updated: false,
      message: 'Counts already match',
    };
  } catch (error) {
    logger.error('Single promo code reconciliation error:', error);
    throw error;
  }
}

module.exports = {
  reconcilePromoCodeUsage,
  reconcileSinglePromoCode,
};

