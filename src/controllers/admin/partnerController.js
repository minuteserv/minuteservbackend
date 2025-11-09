const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Get all partners
 */
async function getAdminPartners(req, res) {
  try {
    const { status } = req.query;

    let query = supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data: partners, error } = await query;

    if (error) {
      logger.error('Get admin partners error:', error);
      throw new Error('Failed to fetch partners');
    }

    return successResponse(res, partners || []);
  } catch (error) {
    logger.error('Get admin partners error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get partner by ID
 */
async function getAdminPartnerById(req, res) {
  try {
    const { id } = req.params;

    const { data: partner, error } = await supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !partner) {
      return errorResponse(res, { message: 'Partner not found' }, 404);
    }

    return successResponse(res, partner);
  } catch (error) {
    logger.error('Get admin partner by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create partner
 */
async function createPartner(req, res) {
  try {
    const {
      name,
      phone_number,
      email,
      service_categories,
      is_active = true
    } = req.body;

    if (!name || !phone_number || !service_categories) {
      return errorResponse(res, { message: 'Name, phone number, and service categories are required' }, 400);
    }

    // Generate partner code
    const { count: partnerCount } = await supabase
      .from('partners')
      .select('*', { count: 'exact', head: true });

    const partnerCode = `PT-${String((partnerCount || 0) + 1).padStart(3, '0')}`;

    const { data: partner, error } = await supabase
      .from('partners')
      .insert({
        partner_code: partnerCode,
        name,
        phone_number,
        email: email || null,
        service_categories: Array.isArray(service_categories) ? service_categories : [service_categories],
        is_active,
        is_available: true
      })
      .select()
      .single();

    if (error) {
      logger.error('Create partner error:', error);
      throw new Error('Failed to create partner');
    }

    return successResponse(res, partner, 'Partner created successfully', 201);
  } catch (error) {
    logger.error('Create partner error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update partner
 */
async function updatePartner(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data: partner, error } = await supabase
      .from('partners')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update partner error:', error);
      throw new Error('Failed to update partner');
    }

    return successResponse(res, partner, 'Partner updated successfully');
  } catch (error) {
    logger.error('Update partner error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminPartners,
  getAdminPartnerById,
  createPartner,
  updatePartner
};

