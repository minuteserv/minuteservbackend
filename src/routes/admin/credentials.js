const express = require('express');
const router = express.Router();
const {
  getBusinessCredentials,
  getCredentialStats,
  getCredentialById,
  createCredential,
  updateCredential,
  deleteCredential,
  getCredentialAccessLogs,
} = require('../../controllers/admin/credentialsController');
const { adminAuth } = require('../../middleware/adminAuth');

// Get credential statistics
router.get('/stats', adminAuth, getCredentialStats);

// Get credential access logs (audit trail)
router.get('/logs', adminAuth, getCredentialAccessLogs);

// Get all credentials (with filters)
router.get('/', adminAuth, getBusinessCredentials);

// Get credential by ID (with optional password decryption)
router.get('/:id', adminAuth, getCredentialById);

// Create new credential
router.post('/', adminAuth, createCredential);

// Update credential
router.put('/:id', adminAuth, updateCredential);
router.patch('/:id', adminAuth, updateCredential);

// Delete credential
router.delete('/:id', adminAuth, deleteCredential);

module.exports = router;

