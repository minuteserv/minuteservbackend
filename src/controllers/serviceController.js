const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

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
      logger.error('Get all services error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      logger.info('Falling back to services.json file');
      
      // Fallback to services.json
      try {
        const servicesJsonPath = path.join(__dirname, '../../../../src/data/services.json');
        const servicesData = JSON.parse(fs.readFileSync(servicesJsonPath, 'utf8'));
        
        // Flatten the services from the JSON structure
        const allServices = [];
        if (servicesData.tiers) {
          servicesData.tiers.forEach(tier => {
            tier.categories.forEach(category => {
              category.items.forEach(item => {
                allServices.push({
                  id: `${tier.tier}-${category.category}-${item.name}`.toLowerCase().replace(/\s+/g, '-'),
                  name: item.name,
                  category: category.category,
                  tier: tier.tier,
                  brand: item.brand || null,
                  productCost: item.productCost || 0,
                  marketPrice: item.marketPrice || null,
                  durationMinutes: item.durationMinutes || 60,
                  image: item.image || null,
                });
              });
            });
          });
        }
        
        // Apply filters
        let filteredServices = allServices;
        if (tier) {
          filteredServices = filteredServices.filter(s => s.tier === tier);
        }
        if (category) {
          filteredServices = filteredServices.filter(s => s.category === category);
        }
        
        return successResponse(res, filteredServices);
      } catch (fallbackError) {
        logger.error('Fallback to services.json also failed:', fallbackError);
        return successResponse(res, []);
      }
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

