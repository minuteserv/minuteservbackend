const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middleware/adminAuth');
const inventoryController = require('../../controllers/admin/inventoryController');

// Apply admin auth middleware to all routes
router.use(adminAuth);

// ============================================
// INVENTORY DASHBOARD
// ============================================
router.get('/dashboard', inventoryController.getInventoryDashboard);

// ============================================
// SUPPLIERS ROUTES
// ============================================
router.get('/suppliers', inventoryController.getAllSuppliers);
router.get('/suppliers/:id', inventoryController.getSupplierById);
router.post('/suppliers', inventoryController.createSupplier);
router.put('/suppliers/:id', inventoryController.updateSupplier);
router.delete('/suppliers/:id', inventoryController.deleteSupplier);

// ============================================
// PRODUCTS ROUTES
// ============================================
router.get('/products', inventoryController.getAllProducts);
router.get('/products/:id', inventoryController.getProductById);
router.post('/products', inventoryController.createProduct);
router.put('/products/:id', inventoryController.updateProduct);
router.delete('/products/:id', inventoryController.deleteProduct);

// ============================================
// SERVICE KITS ROUTES
// ============================================
router.get('/kits', inventoryController.getAllServiceKits);
router.get('/kits/:id', inventoryController.getServiceKitById);
router.post('/kits', inventoryController.createServiceKit);
router.put('/kits/:id', inventoryController.updateServiceKit);
router.delete('/kits/:id', inventoryController.deleteServiceKit);

// Kit Items
router.post('/kits/:id/items', inventoryController.addKitItem);
router.delete('/kits/:id/items/:productId', inventoryController.removeKitItem);

// ============================================
// PARTNER KIT ASSIGNMENTS ROUTES
// ============================================
router.post('/assign-kit', inventoryController.assignKitToPartner);
router.get('/partner-kits/:partnerId', inventoryController.getPartnerKits);
router.post('/return-kit/:assignmentId', inventoryController.returnKit);

// ============================================
// STOCK MOVEMENTS ROUTES
// ============================================
router.get('/stock-movements', inventoryController.getStockMovements);
router.post('/stock-movements', inventoryController.createStockMovement);

// ============================================
// STOCK ALERTS ROUTES
// ============================================
router.get('/alerts', inventoryController.getStockAlerts);
router.post('/alerts/:id/resolve', inventoryController.resolveAlert);

module.exports = router;

