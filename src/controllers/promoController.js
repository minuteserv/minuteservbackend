const { successResponse, errorResponse } = require('../utils/response');
const { validatePromoCode } = require('../services/promoService');

/**
 * Validate promo code via API
 */
async function applyPromoCode(req, res) {
  try {
    const { code, amount } = req.body;

    if (!code || typeof code !== 'string') {
      return errorResponse(res, { message: 'Promo code is required' }, 400);
    }

    const orderAmount = Number(amount) || 0;
    const userId = req.user?.id || null;

    const result = await validatePromoCode(code, orderAmount, userId);

    if (!result.valid) {
      return errorResponse(
        res,
        { message: result.message || 'Invalid promo code' },
        400
      );
    }

    return successResponse(
      res,
      result,
      'Promo code applied successfully'
    );
  } catch (error) {
    return errorResponse(res, error, 500);
  }
}

module.exports = { applyPromoCode };

