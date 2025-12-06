const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Inventory & Operations Service
 * Comprehensive service for managing inventory, products, kits, and suppliers
 */

// ============================================
// DASHBOARD
// ============================================

/**
 * Get inventory dashboard stats
 */
async function getInventoryDashboard() {
  try {
    // Total products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Low stock products - fetch all and filter in memory (can't compare columns in Supabase query)
    const { data: allProducts } = await supabase
      .from('products')
      .select('current_stock, minimum_stock_level');
    const lowStock = allProducts?.filter(p => (p.current_stock || 0) <= (p.minimum_stock_level || 0)).length || 0;

    // Active suppliers
    const { count: activeSuppliers } = await supabase
      .from('suppliers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Total kits
    const { count: totalKits } = await supabase
      .from('service_kits')
      .select('*', { count: 'exact', head: true });

    // Unresolved alerts
    const { count: unresolvedAlerts } = await supabase
      .from('stock_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_resolved', false);

    // Total inventory value
    const { data: products } = await supabase
      .from('products')
      .select('current_stock, cost_price');

    const totalValue = products?.reduce(
      (sum, p) => sum + (p.current_stock || 0) * (p.cost_price || 0),
      0
    ) || 0;

    return {
      products: {
        total: totalProducts || 0,
        low_stock: lowStock || 0,
      },
      suppliers: {
        active: activeSuppliers || 0,
      },
      kits: {
        total: totalKits || 0,
      },
      alerts: {
        unresolved: unresolvedAlerts || 0,
      },
      inventory_value: totalValue,
    };
  } catch (error) {
    logger.error('Get inventory dashboard error:', error);
    throw error;
  }
}

// ============================================
// SUPPLIERS MANAGEMENT
// ============================================

/**
 * Get all suppliers with filters
 */
async function getAllSuppliers(filters = {}) {
  try {
    let query = supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Get all suppliers error:', error);
    throw error;
  }
}

/**
 * Get supplier by ID
 */
async function getSupplierById(id) {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Get supplier by ID error:', error);
    throw error;
  }
}

/**
 * Create supplier
 */
async function createSupplier(supplierData) {
  try {
    const supplierPayload = {
      name: supplierData.name,
      contact_person: supplierData.contact_person || null,
      email: supplierData.email || null,
      phone_number: supplierData.phone_number || null,
      address: supplierData.address || null,
      city: supplierData.city || null,
      state: supplierData.state || null,
      pincode: supplierData.pincode || null,
      gst_number: supplierData.gst_number || null,
      pan_number: supplierData.pan_number || null,
      payment_terms: supplierData.payment_terms || null,
      notes: supplierData.notes || null,
      is_active: supplierData.is_active !== undefined ? supplierData.is_active : true,
      created_by: supplierData.created_by || null,
    };

    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplierPayload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Create supplier error:', error);
    throw error;
  }
}

/**
 * Update supplier
 */
async function updateSupplier(id, updates) {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Update supplier error:', error);
    throw error;
  }
}

/**
 * Delete supplier
 */
async function deleteSupplier(id) {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Delete supplier error:', error);
    throw error;
  }
}

// ============================================
// PRODUCTS MANAGEMENT
// ============================================

/**
 * Get all products with filters
 */
async function getAllProducts(filters = {}) {
  try {
    let query = supabase
      .from('products')
      .select(`
        *,
        supplier:supplier_id (id, name)
      `)
      .order('created_at', { ascending: false });

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.supplier_id) {
      query = query.eq('supplier_id', filters.supplier_id);
    }
    // Note: low_stock filter will be applied after fetching (can't compare columns in Supabase query)
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    let result = data || [];

    // Apply low_stock filter after fetching (can't compare columns in Supabase query)
    if (filters.low_stock) {
      result = result.filter(p => (p.current_stock || 0) <= (p.minimum_stock_level || 0));
    }

    return result;
  } catch (error) {
    logger.error('Get all products error:', error);
    throw error;
  }
}

/**
 * Get product by ID
 */
async function getProductById(id) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        supplier:supplier_id (id, name, email, phone_number)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Get product by ID error:', error);
    throw error;
  }
}

/**
 * Create product
 */
async function createProduct(productData) {
  try {
    // Check SKU uniqueness if provided
    if (productData.sku) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', productData.sku)
        .single();

      if (existing) {
        throw new Error('Product with this SKU already exists');
      }
    }

    const productPayload = {
      name: productData.name,
      sku: productData.sku || null,
      description: productData.description || null,
      category: productData.category || null,
      unit: productData.unit || 'piece',
      cost_price: productData.cost_price || 0,
      selling_price: productData.selling_price || null,
      minimum_stock_level: productData.minimum_stock_level || 0,
      current_stock: productData.current_stock || 0,
      reorder_point: productData.reorder_point || 0,
      supplier_id: productData.supplier_id || null,
      image_url: productData.image_url || null,
      barcode: productData.barcode || null,
      brand: productData.brand || null,
      expiry_date: productData.expiry_date || null,
      batch_number: productData.batch_number || null,
      location: productData.location || null,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
      created_by: productData.created_by || null,
      metadata: productData.metadata || {},
    };

    const { data, error } = await supabase
      .from('products')
      .insert([productPayload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Create product error:', error);
    throw error;
  }
}

/**
 * Update product
 */
async function updateProduct(id, updates) {
  try {
    // Check SKU uniqueness if being updated
    if (updates.sku) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', updates.sku)
        .neq('id', id)
        .single();

      if (existing) {
        throw new Error('Product with this SKU already exists');
      }
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Update product error:', error);
    throw error;
  }
}

/**
 * Delete product
 */
async function deleteProduct(id) {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Delete product error:', error);
    throw error;
  }
}

// ============================================
// SERVICE KITS MANAGEMENT
// ============================================

/**
 * Get all service kits with filters
 */
async function getAllServiceKits(filters = {}) {
  try {
    let query = supabase
      .from('service_kits')
      .select(`
        *,
        service:service_id (id, name)
      `)
      .order('created_at', { ascending: false });

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.service_id) {
      query = query.eq('service_id', filters.service_id);
    }
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get items for each kit
    const kitsWithItems = await Promise.all(
      (data || []).map(async (kit) => {
        const { data: items } = await supabase
          .from('service_kit_items')
          .select(`
            *,
            product:product_id (id, name, sku, unit, cost_price)
          `)
          .eq('kit_id', kit.id);

        return {
          ...kit,
          items: items || [],
        };
      })
    );

    return kitsWithItems;
  } catch (error) {
    logger.error('Get all service kits error:', error);
    throw error;
  }
}

/**
 * Get service kit by ID
 */
async function getServiceKitById(id) {
  try {
    const { data: kit, error: kitError } = await supabase
      .from('service_kits')
      .select(`
        *,
        service:service_id (id, name)
      `)
      .eq('id', id)
      .single();

    if (kitError) throw kitError;

    const { data: items } = await supabase
      .from('service_kit_items')
      .select(`
        *,
        product:product_id (id, name, sku, unit, cost_price, current_stock)
      `)
      .eq('kit_id', id);

    return {
      ...kit,
      items: items || [],
    };
  } catch (error) {
    logger.error('Get service kit by ID error:', error);
    throw error;
  }
}

/**
 * Create service kit
 */
async function createServiceKit(kitData) {
  try {
    const kitPayload = {
      name: kitData.name,
      description: kitData.description || null,
      service_id: kitData.service_id || null,
      is_active: kitData.is_active !== undefined ? kitData.is_active : true,
      created_by: kitData.created_by || null,
    };

    const { data: kit, error: kitError } = await supabase
      .from('service_kits')
      .insert([kitPayload])
      .select()
      .single();

    if (kitError) throw kitError;

    // Add items if provided
    if (kitData.items && Array.isArray(kitData.items) && kitData.items.length > 0) {
      const items = kitData.items.map((item) => ({
        kit_id: kit.id,
        product_id: item.product_id,
        quantity: item.quantity || 1,
        unit_cost: item.unit_cost || 0,
        total_cost: (item.quantity || 1) * (item.unit_cost || 0),
      }));

      await supabase.from('service_kit_items').insert(items);
    }

    return await getServiceKitById(kit.id);
  } catch (error) {
    logger.error('Create service kit error:', error);
    throw error;
  }
}

/**
 * Update service kit
 */
async function updateServiceKit(id, updates) {
  try {
    const { data, error } = await supabase
      .from('service_kits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return await getServiceKitById(id);
  } catch (error) {
    logger.error('Update service kit error:', error);
    throw error;
  }
}

/**
 * Add item to service kit
 */
async function addKitItem(kitId, itemData) {
  try {
    const { data: product } = await supabase
      .from('products')
      .select('cost_price')
      .eq('id', itemData.product_id)
      .single();

    const unitCost = itemData.unit_cost || product?.cost_price || 0;
    const quantity = itemData.quantity || 1;
    const totalCost = quantity * unitCost;

    const itemPayload = {
      kit_id: kitId,
      product_id: itemData.product_id,
      quantity: quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
    };

    const { data, error } = await supabase
      .from('service_kit_items')
      .insert([itemPayload])
      .select()
      .single();

    if (error) throw error;
    return await getServiceKitById(kitId);
  } catch (error) {
    logger.error('Add kit item error:', error);
    throw error;
  }
}

/**
 * Remove item from service kit
 */
async function removeKitItem(kitId, productId) {
  try {
    const { error } = await supabase
      .from('service_kit_items')
      .delete()
      .eq('kit_id', kitId)
      .eq('product_id', productId);

    if (error) throw error;
    return await getServiceKitById(kitId);
  } catch (error) {
    logger.error('Remove kit item error:', error);
    throw error;
  }
}

/**
 * Delete service kit
 */
async function deleteServiceKit(id) {
  try {
    const { data, error } = await supabase
      .from('service_kits')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Delete service kit error:', error);
    throw error;
  }
}

// ============================================
// PARTNER KIT ASSIGNMENTS
// ============================================

/**
 * Assign kit to partner
 */
async function assignKitToPartner(partnerId, kitId, quantity = 1, assignedBy = null) {
  try {
    const assignmentPayload = {
      partner_id: partnerId,
      kit_id: kitId,
      quantity: quantity,
      status: 'assigned',
      assigned_by: assignedBy,
    };

    const { data, error } = await supabase
      .from('partner_kit_assignments')
      .insert([assignmentPayload])
      .select(`
        *,
        partner:partner_id (id, name, phone_number),
        kit:kit_id (id, name)
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Assign kit to partner error:', error);
    throw error;
  }
}

/**
 * Get partner kit assignments
 */
async function getPartnerKits(partnerId) {
  try {
    const { data, error } = await supabase
      .from('partner_kit_assignments')
      .select(`
        *,
        kit:kit_id (id, name, total_cost)
      `)
      .eq('partner_id', partnerId)
      .order('assigned_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Get partner kits error:', error);
    throw error;
  }
}

/**
 * Return kit
 */
async function returnKit(assignmentId, status = 'returned', notes = null) {
  try {
    const { data, error } = await supabase
      .from('partner_kit_assignments')
      .update({
        status: status,
        return_date: new Date().toISOString(),
        notes: notes,
      })
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Return kit error:', error);
    throw error;
  }
}

// ============================================
// STOCK MOVEMENTS
// ============================================

/**
 * Get stock movements with filters
 */
async function getStockMovements(filters = {}) {
  try {
    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        product:product_id (id, name, sku)
      `)
      .order('movement_date', { ascending: false })
      .limit(filters.limit || 100);

    if (filters.product_id) {
      query = query.eq('product_id', filters.product_id);
    }
    if (filters.movement_type) {
      query = query.eq('movement_type', filters.movement_type);
    }
    if (filters.date_from) {
      query = query.gte('movement_date', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('movement_date', filters.date_to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Get stock movements error:', error);
    throw error;
  }
}

/**
 * Create stock movement
 */
async function createStockMovement(movementData) {
  try {
    const { data: product } = await supabase
      .from('products')
      .select('current_stock, cost_price')
      .eq('id', movementData.product_id)
      .single();

    if (!product) {
      throw new Error('Product not found');
    }

    const previousStock = product.current_stock || 0;
    let newStock = previousStock;

    // Calculate new stock based on movement type
    switch (movementData.movement_type) {
      case 'purchase':
      case 'return':
      case 'adjustment_increase':
        newStock = previousStock + movementData.quantity;
        break;
      case 'sale':
      case 'damaged':
      case 'expiry':
      case 'adjustment_decrease':
        newStock = previousStock - movementData.quantity;
        break;
      case 'transfer_out':
        newStock = previousStock - movementData.quantity;
        break;
      case 'transfer_in':
        newStock = previousStock + movementData.quantity;
        break;
    }

    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    const unitCost = movementData.unit_cost || product.cost_price || 0;
    const totalCost = movementData.quantity * unitCost;

    const movementPayload = {
      product_id: movementData.product_id,
      movement_type: movementData.movement_type,
      quantity: movementData.quantity,
      previous_stock: previousStock,
      new_stock: newStock,
      unit_cost: unitCost,
      total_cost: totalCost,
      reference_type: movementData.reference_type || null,
      reference_id: movementData.reference_id || null,
      notes: movementData.notes || null,
      created_by: movementData.created_by || null,
    };

    // Insert movement (trigger will update product stock)
    const { data, error } = await supabase
      .from('stock_movements')
      .insert([movementPayload])
      .select()
      .single();

    if (error) throw error;

    // Update product stock
    await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', movementData.product_id);

    return data;
  } catch (error) {
    logger.error('Create stock movement error:', error);
    throw error;
  }
}

// ============================================
// STOCK ALERTS
// ============================================

/**
 * Get stock alerts with filters
 */
async function getStockAlerts(filters = {}) {
  try {
    let query = supabase
      .from('stock_alerts')
      .select(`
        *,
        product:product_id (id, name, sku, current_stock, minimum_stock_level)
      `)
      .order('created_at', { ascending: false });

    if (filters.is_resolved !== undefined) {
      query = query.eq('is_resolved', filters.is_resolved);
    }
    if (filters.alert_type) {
      query = query.eq('alert_type', filters.alert_type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Get stock alerts error:', error);
    throw error;
  }
}

/**
 * Resolve stock alert
 */
async function resolveAlert(alertId, userId = null) {
  try {
    const { data, error } = await supabase
      .from('stock_alerts')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Resolve alert error:', error);
    throw error;
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

