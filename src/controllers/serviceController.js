const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// Simple in-memory cache (for development)
// In production, use Redis
let serviceCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get service catalog (grouped by category)
 */
async function getServiceCatalog(req, res) {
  try {
    // Check cache
    if (serviceCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL) {
      return successResponse(res, serviceCache);
    }

    // Fetch from database
    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('tier');

    if (error) {
      logger.error('Get services error:', error);
      throw new Error('Failed to fetch services');
    }

    // Group by category
    const categories = {};
    services.forEach(service => {
      if (!categories[service.category]) {
        categories[service.category] = [];
      }
      categories[service.category].push({
        id: service.id,
        name: service.name,
        category: service.category,
        tier: service.tier,
        brand: service.brand || null,
        product_cost: parseFloat(service.product_cost),
        market_price: service.market_price ? parseFloat(service.market_price) : null,
        duration_minutes: service.duration_minutes,
        image_url: service.image_url
      });
    });

    const response = {
      categories,
      all_services: services,
      last_updated: new Date().toISOString()
    };

    // Update cache
    serviceCache = response;
    cacheTimestamp = Date.now();

    return successResponse(res, response);
  } catch (error) {
    logger.error('Get service catalog error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get all services (simple list for frontend)
 */
async function getAllServices(req, res) {
  try {
    const { tier, category, is_active = true } = req.query;

    let query = supabase
      .from('services')
      .select('*')
      .order('category')
      .order('tier')
      .order('name');

    if (is_active === 'true' || is_active === true) {
      query = query.eq('is_active', true);
    }

    if (tier) {
      query = query.eq('tier', tier);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: services, error } = await query;

    if (error) {
      logger.error('Get all services error:', error);
      throw new Error('Failed to fetch services');
    }

    // Transform to match frontend format
    const transformedServices = services.map(service => ({
      id: service.id,
      name: service.name,
      category: service.category,
      tier: service.tier,
      brand: service.brand || null,
      productCost: parseFloat(service.product_cost || 0),
      marketPrice: service.market_price ? parseFloat(service.market_price) : null,
      durationMinutes: service.duration_minutes || 60,
      image: service.image_url || null,
    }));

    return successResponse(res, transformedServices);
  } catch (error) {
    logger.error('Get all services error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get service by ID
 */
async function getServiceById(req, res) {
  try {
    const { id } = req.params;

    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !service) {
      return errorResponse(res, { message: 'Service not found' }, 404);
    }

    return successResponse(res, {
      id: service.id,
      name: service.name,
      category: service.category,
      tier: service.tier,
      brand: service.brand || null,
      product_cost: parseFloat(service.product_cost),
      market_price: service.market_price ? parseFloat(service.market_price) : null,
      duration_minutes: service.duration_minutes,
      image_url: service.image_url
    });
  } catch (error) {
    logger.error('Get service by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getServiceCatalog,
  getAllServices,
  getServiceById
};

