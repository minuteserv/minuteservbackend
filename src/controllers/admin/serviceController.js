const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Get all services
 */
async function getAdminServices(req, res) {
  try {
    const { category, tier, is_active } = req.query;

    let query = supabase
      .from('services')
      .select('*')
      .order('category')
      .order('tier');

    if (category) query = query.eq('category', category);
    if (tier) query = query.eq('tier', tier);
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

    const { data: services, error } = await query;

    if (error) {
      logger.error('Get admin services error:', error);
      throw new Error('Failed to fetch services');
    }

    return successResponse(res, services || []);
  } catch (error) {
    logger.error('Get admin services error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create service
 */
async function createService(req, res) {
  try {
    const {
      name,
      category,
      tier,
      product_cost,
      market_price,
      duration_minutes = 60,
      image_url,
      is_active = true
    } = req.body;

    if (!name || !category || !tier || !product_cost) {
      return errorResponse(res, { message: 'Name, category, tier, and product_cost are required' }, 400);
    }

    const { data: service, error } = await supabase
      .from('services')
      .insert({
        name,
        category,
        tier,
        product_cost: parseFloat(product_cost),
        market_price: market_price ? parseFloat(market_price) : null,
        duration_minutes: parseInt(duration_minutes),
        image_url: image_url || null,
        is_active
      })
      .select()
      .single();

    if (error) {
      logger.error('Create service error:', error);
      throw new Error('Failed to create service');
    }

    return successResponse(res, service, 'Service created successfully', 201);
  } catch (error) {
    logger.error('Create service error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update service
 */
async function updateService(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Convert price fields to numbers if present
    if (updateData.product_cost) {
      updateData.product_cost = parseFloat(updateData.product_cost);
    }
    if (updateData.market_price) {
      updateData.market_price = parseFloat(updateData.market_price);
    }

    const { data: service, error } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update service error:', error);
      throw new Error('Failed to update service');
    }

    // Clear service cache
    if (require('../serviceController').serviceCache) {
      require('../serviceController').serviceCache = null;
    }

    return successResponse(res, service, 'Service updated successfully');
  } catch (error) {
    logger.error('Update service error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminServices,
  createService,
  updateService
};

