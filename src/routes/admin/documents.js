const express = require('express');
const router = express.Router();
const {
  getBusinessDocuments,
  getDocumentStats,
  getDocumentById,
  uploadDocument,
  updateDocument,
  deleteDocument,
  archiveDocument,
  downloadDocument,
} = require('../../controllers/admin/documentsController');
const { adminAuth } = require('../../middleware/adminAuth');

// Get document statistics
router.get('/stats', adminAuth, getDocumentStats);

// Get all documents (with filters)
router.get('/', adminAuth, getBusinessDocuments);

// Get document by ID
router.get('/:id', adminAuth, getDocumentById);

// Download document (get download URL)
router.get('/:id/download', adminAuth, downloadDocument);

// Upload new document
router.post('/', adminAuth, uploadDocument);

// Update document metadata
router.put('/:id', adminAuth, updateDocument);
router.patch('/:id', adminAuth, updateDocument);

// Archive/Unarchive document
router.patch('/:id/archive', adminAuth, archiveDocument);

// Delete document
router.delete('/:id', adminAuth, deleteDocument);

module.exports = router;

