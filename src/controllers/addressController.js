const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get user addresses
 */
async function getUserAddresses(req, res) {
  try {
    const userId = req.user.id;

    const { data: addresses, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Get addresses error:', error);
      throw new Error('Failed to fetch addresses');
    }

    return successResponse(res, addresses || []);
  } catch (error) {
    logger.error('Get user addresses error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create address
 */
async function createAddress(req, res) {
  try {
    const userId = req.user.id;
    const {
      name = 'Home',
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      lat,
      lng,
      place_id,
      is_default = false
    } = req.body;

    // Validation
    if (!address_line1 || !city || !state || !pincode) {
      return errorResponse(res, { message: 'Missing required fields' }, 400);
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true);
    }

    const { data: address, error } = await supabase
      .from('user_addresses')
      .insert({
        user_id: userId,
        name,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        place_id,
        is_default
      })
      .select()
      .single();

    if (error) {
      logger.error('Create address error:', error);
      throw new Error('Failed to create address');
    }

    return successResponse(res, address, 'Address created successfully', 201);
  } catch (error) {
    logger.error('Create address error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update address
 */
async function updateAddress(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    // Verify address belongs to user
    const { data: existing } = await supabase
      .from('user_addresses')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return errorResponse(res, { message: 'Address not found' }, 404);
    }

    // If setting as default, unset other defaults
    if (updateData.is_default) {
      await supabase
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true)
        .neq('id', id);
    }

    const { data: address, error } = await supabase
      .from('user_addresses')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Update address error:', error);
      throw new Error('Failed to update address');
    }

    return successResponse(res, address, 'Address updated successfully');
  } catch (error) {
    logger.error('Update address error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Delete address
 */
async function deleteAddress(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify address belongs to user
    const { data: existing } = await supabase
      .from('user_addresses')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return errorResponse(res, { message: 'Address not found' }, 404);
    }

    const { error } = await supabase
      .from('user_addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error('Delete address error:', error);
      throw new Error('Failed to delete address');
    }

    return successResponse(res, null, 'Address deleted successfully');
  } catch (error) {
    logger.error('Delete address error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Set default address
 */
async function setDefaultAddress(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify address belongs to user
    const { data: existing } = await supabase
      .from('user_addresses')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return errorResponse(res, { message: 'Address not found' }, 404);
    }

    // Unset all defaults
    await supabase
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    // Set this as default
    const { data: address, error } = await supabase
      .from('user_addresses')
      .update({ is_default: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Set default address error:', error);
      throw new Error('Failed to set default address');
    }

    return successResponse(res, address, 'Default address updated');
  } catch (error) {
    logger.error('Set default address error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};

