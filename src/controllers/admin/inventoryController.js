const { successResponse, errorResponse } = require('../../utils/response');
const inventoryService = require('../../services/inventoryService');
const logger = require('../../utils/logger');

// ============================================
// DASHBOARD
// ============================================

/**
 * Get inventory dashboard stats
 */
async function getInventoryDashboard(req, res) {
  try {
    const stats = await inventoryService.getInventoryDashboard();
    return successResponse(res, stats);
  } catch (error) {
    logger.error('Get inventory dashboard error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// SUPPLIERS CONTROLLERS
// ============================================

/**
 * Get all suppliers
 */
async function getAllSuppliers(req, res) {
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      search: req.query.search,
    };

    const suppliers = await inventoryService.getAllSuppliers(filters);
    return successResponse(res, suppliers);
  } catch (error) {
    logger.error('Get all suppliers error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get supplier by ID
 */
async function getSupplierById(req, res) {
  try {
    const { id } = req.params;
    const supplier = await inventoryService.getSupplierById(id);

    if (!supplier) {
      return errorResponse(res, { message: 'Supplier not found' }, 404);
    }

    return successResponse(res, supplier);
  } catch (error) {
    logger.error('Get supplier by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create supplier
 */
async function createSupplier(req, res) {
  try {
    const supplierData = {
      ...req.body,
      created_by: req.admin?.id,
    };

    const supplier = await inventoryService.createSupplier(supplierData);
    return successResponse(res, supplier, 'Supplier created successfully', 201);
  } catch (error) {
    logger.error('Create supplier error:', error);
    const message = error.message || 'Failed to create supplier';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Update supplier
 */
async function updateSupplier(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const supplier = await inventoryService.updateSupplier(id, updates);
    return successResponse(res, supplier, 'Supplier updated successfully');
  } catch (error) {
    logger.error('Update supplier error:', error);
    const message = error.message || 'Failed to update supplier';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Delete supplier
 */
async function deleteSupplier(req, res) {
  try {
    const { id } = req.params;
    await inventoryService.deleteSupplier(id);
    return successResponse(res, null, 'Supplier deleted successfully');
  } catch (error) {
    logger.error('Delete supplier error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// PRODUCTS CONTROLLERS
// ============================================

/**
 * Get all products
 */
async function getAllProducts(req, res) {
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      category: req.query.category,
      supplier_id: req.query.supplier_id,
      low_stock: req.query.low_stock === 'true',
      search: req.query.search,
    };

    const products = await inventoryService.getAllProducts(filters);
    return successResponse(res, products);
  } catch (error) {
    logger.error('Get all products error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get product by ID
 */
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const product = await inventoryService.getProductById(id);

    if (!product) {
      return errorResponse(res, { message: 'Product not found' }, 404);
    }

    return successResponse(res, product);
  } catch (error) {
    logger.error('Get product by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create product
 */
async function createProduct(req, res) {
  try {
    const productData = {
      ...req.body,
      created_by: req.admin?.id,
    };

    const product = await inventoryService.createProduct(productData);
    return successResponse(res, product, 'Product created successfully', 201);
  } catch (error) {
    logger.error('Create product error:', error);
    const message = error.message || 'Failed to create product';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Update product
 */
async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await inventoryService.updateProduct(id, updates);
    return successResponse(res, product, 'Product updated successfully');
  } catch (error) {
    logger.error('Update product error:', error);
    const message = error.message || 'Failed to update product';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Delete product
 */
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    await inventoryService.deleteProduct(id);
    return successResponse(res, null, 'Product deleted successfully');
  } catch (error) {
    logger.error('Delete product error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// SERVICE KITS CONTROLLERS
// ============================================

/**
 * Get all service kits
 */
async function getAllServiceKits(req, res) {
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      service_id: req.query.service_id,
      search: req.query.search,
    };

    const kits = await inventoryService.getAllServiceKits(filters);
    return successResponse(res, kits);
  } catch (error) {
    logger.error('Get all service kits error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get service kit by ID
 */
async function getServiceKitById(req, res) {
  try {
    const { id } = req.params;
    const kit = await inventoryService.getServiceKitById(id);

    if (!kit) {
      return errorResponse(res, { message: 'Service kit not found' }, 404);
    }

    return successResponse(res, kit);
  } catch (error) {
    logger.error('Get service kit by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create service kit
 */
async function createServiceKit(req, res) {
  try {
    const kitData = {
      ...req.body,
      created_by: req.admin?.id,
    };

    const kit = await inventoryService.createServiceKit(kitData);
    return successResponse(res, kit, 'Service kit created successfully', 201);
  } catch (error) {
    logger.error('Create service kit error:', error);
    const message = error.message || 'Failed to create service kit';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Update service kit
 */
async function updateServiceKit(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const kit = await inventoryService.updateServiceKit(id, updates);
    return successResponse(res, kit, 'Service kit updated successfully');
  } catch (error) {
    logger.error('Update service kit error:', error);
    const message = error.message || 'Failed to update service kit';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Add item to service kit
 */
async function addKitItem(req, res) {
  try {
    const { id } = req.params;
    const itemData = req.body;

    const kit = await inventoryService.addKitItem(id, itemData);
    return successResponse(res, kit, 'Item added to kit successfully');
  } catch (error) {
    logger.error('Add kit item error:', error);
    const message = error.message || 'Failed to add item to kit';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Remove item from service kit
 */
async function removeKitItem(req, res) {
  try {
    const { id, productId } = req.params;

    const kit = await inventoryService.removeKitItem(id, productId);
    return successResponse(res, kit, 'Item removed from kit successfully');
  } catch (error) {
    logger.error('Remove kit item error:', error);
    const message = error.message || 'Failed to remove item from kit';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Delete service kit
 */
async function deleteServiceKit(req, res) {
  try {
    const { id } = req.params;
    await inventoryService.deleteServiceKit(id);
    return successResponse(res, null, 'Service kit deleted successfully');
  } catch (error) {
    logger.error('Delete service kit error:', error);
    return errorResponse(res, error, 500);
  }
}

// ============================================
// PARTNER KIT ASSIGNMENTS CONTROLLERS
// ============================================

/**
 * Assign kit to partner
 */
async function assignKitToPartner(req, res) {
  try {
    const { partner_id, kit_id, quantity } = req.body;

    if (!partner_id || !kit_id) {
      return errorResponse(res, { message: 'Partner ID and Kit ID are required' }, 400);
    }

    const assignment = await inventoryService.assignKitToPartner(
      partner_id,
      kit_id,
      quantity || 1,
      req.admin?.id
    );
    return successResponse(res, assignment, 'Kit assigned to partner successfully', 201);
  } catch (error) {
    logger.error('Assign kit to partner error:', error);
    const message = error.message || 'Failed to assign kit to partner';
    return errorResponse(res, { message }, 400);
  }
}

/**
 * Get partner kits
 */
async function getPartnerKits(req, res) {
  try {
    const { partnerId } = req.params;
    const kits = await inventoryService.getPartnerKits(partnerId);
    return successResponse(res, kits);
  } catch (error) {
    logger.error('Get partner kits error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Return kit
 */
async function returnKit(req, res) {
  try {
    const { assignmentId } = req.params;
    const { status, notes } = req.body;

    const assignment = await inventoryService.returnKit(
      assignmentId,
      status || 'returned',
      notes
    );
    return successResponse(res, assignment, 'Kit returned successfully');
  } catch (error) {
    logger.error('Return kit error:', error);
    const message = error.message || 'Failed to return kit';
    return errorResponse(res, { message }, 400);
  }
}

// ============================================
// STOCK MOVEMENTS CONTROLLERS
// ============================================

/**
 * Get stock movements
 */
async function getStockMovements(req, res) {
  try {
    const filters = {
      product_id: req.query.product_id,
      movement_type: req.query.movement_type,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
    };

    const movements = await inventoryService.getStockMovements(filters);
    return successResponse(res, movements);
  } catch (error) {
    logger.error('Get stock movements error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create stock movement
 */
async function createStockMovement(req, res) {
  try {
    const movementData = {
      ...req.body,
      created_by: req.admin?.id,
    };

    const movement = await inventoryService.createStockMovement(movementData);
    return successResponse(res, movement, 'Stock movement recorded successfully', 201);
  } catch (error) {
    logger.error('Create stock movement error:', error);
    const message = error.message || 'Failed to record stock movement';
    return errorResponse(res, { message }, 400);
  }
}

// ============================================
// STOCK ALERTS CONTROLLERS
// ============================================

/**
 * Get stock alerts
 */
async function getStockAlerts(req, res) {
  try {
    const filters = {
      is_resolved: req.query.is_resolved !== undefined ? req.query.is_resolved === 'true' : undefined,
      alert_type: req.query.alert_type,
    };

    const alerts = await inventoryService.getStockAlerts(filters);
    return successResponse(res, alerts);
  } catch (error) {
    logger.error('Get stock alerts error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Resolve stock alert
 */
async function resolveAlert(req, res) {
  try {
    const { id } = req.params;

    const alert = await inventoryService.resolveAlert(id, req.admin?.id);
    return successResponse(res, alert, 'Alert resolved successfully');
  } catch (error) {
    logger.error('Resolve alert error:', error);
    const message = error.message || 'Failed to resolve alert';
    return errorResponse(res, { message }, 400);
  }
}

module.exports = {
  // Dashboard
  getInventoryDashboard,
  // Suppliers
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  // Products
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  // Service Kits
  getAllServiceKits,
  getServiceKitById,
  createServiceKit,
  updateServiceKit,
  addKitItem,
  removeKitItem,
  deleteServiceKit,
  // Partner Kit Assignments
  assignKitToPartner,
  getPartnerKits,
  returnKit,
  // Stock Movements
  getStockMovements,
  createStockMovement,
  // Stock Alerts
  getStockAlerts,
  resolveAlert,
};

