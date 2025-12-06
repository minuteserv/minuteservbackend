const express = require('express');
const router = express.Router();
const { 
  getCategories, 
  getCategoryById, 
  createCategory, 
  updateCategory, 
  deleteCategory 
} = require('../../controllers/admin/categoryController');
const { adminAuth } = require('../../middleware/adminAuth');

// All routes require admin authentication
router.get('/', adminAuth, getCategories);
router.get('/:id', adminAuth, getCategoryById);
router.post('/', adminAuth, createCategory);
router.put('/:id', adminAuth, updateCategory);
router.delete('/:id', adminAuth, deleteCategory);

module.exports = router;

