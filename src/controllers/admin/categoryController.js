const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Get all categories
 */
async function getCategories(req, res) {
  try {
    const { is_active } = req.query;

    let query = supabase
      .from('service_categories')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: categories, error } = await query;

    if (error) {
      logger.error('Get categories error:', error);
      throw new Error('Failed to fetch categories');
    }

    return successResponse(res, categories || []);
  } catch (error) {
    logger.error('Get categories error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get category by ID
 */
async function getCategoryById(req, res) {
  try {
    const { id } = req.params;

    const { data: category, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !category) {
      return errorResponse(res, { message: 'Category not found' }, 404);
    }

    return successResponse(res, category);
  } catch (error) {
    logger.error('Get category by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create category
 */
async function createCategory(req, res) {
  try {
    const { name, description, display_order, is_active = true } = req.body;

    if (!name || !name.trim()) {
      return errorResponse(res, { message: 'Category name is required' }, 400);
    }

    // Check if category already exists
    const { data: existing } = await supabase
      .from('service_categories')
      .select('id')
      .eq('name', name.trim())
      .single();

    if (existing) {
      return errorResponse(res, { message: 'Category with this name already exists' }, 400);
    }

    // Get max display_order if not provided
    let order = display_order;
    if (!order) {
      const { data: maxOrder } = await supabase
        .from('service_categories')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single();
      
      order = maxOrder ? maxOrder.display_order + 1 : 0;
    }

    const { data: category, error } = await supabase
      .from('service_categories')
      .insert({
        name: name.trim(),
        description: description || null,
        display_order: order,
        is_active
      })
      .select()
      .single();

    if (error) {
      logger.error('Create category error:', error);
      throw new Error('Failed to create category');
    }

    return successResponse(res, category, 'Category created successfully', 201);
  } catch (error) {
    logger.error('Create category error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update category
 */
async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, description, display_order, is_active } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description || null;
    if (display_order !== undefined) updateData.display_order = parseInt(display_order);
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    // Check if name already exists (excluding current category)
    if (name) {
      const { data: existing } = await supabase
        .from('service_categories')
        .select('id')
        .eq('name', name.trim())
        .neq('id', id)
        .single();

      if (existing) {
        return errorResponse(res, { message: 'Category with this name already exists' }, 400);
      }
    }

    const { data: category, error } = await supabase
      .from('service_categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update category error:', error);
      throw new Error('Failed to update category');
    }

    if (!category) {
      return errorResponse(res, { message: 'Category not found' }, 404);
    }

    return successResponse(res, category, 'Category updated successfully');
  } catch (error) {
    logger.error('Update category error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Delete category (soft delete by setting is_active to false)
 */
async function deleteCategory(req, res) {
  try {
    const { id } = req.params;

    // Get category name first
    const { data: categoryData } = await supabase
      .from('service_categories')
      .select('name')
      .eq('id', id)
      .single();

    // Check if category is used by any services (services store category as name, not ID)
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, name')
      .eq('category', categoryData?.name || '')
      .limit(1);

    if (servicesError) {
      logger.error('Check category usage error:', servicesError);
    }

    if (services && services.length > 0) {
      return errorResponse(res, { 
        message: 'Cannot delete category. It is being used by one or more services.',
        services: services
      }, 400);
    }

    // Soft delete by setting is_active to false
    const { data: category, error } = await supabase
      .from('service_categories')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Delete category error:', error);
      throw new Error('Failed to delete category');
    }

    if (!category) {
      return errorResponse(res, { message: 'Category not found' }, 404);
    }

    return successResponse(res, category, 'Category deleted successfully');
  } catch (error) {
    logger.error('Delete category error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};

