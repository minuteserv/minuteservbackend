const express = require('express');
const router = express.Router();
const {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} = require('../controllers/addressController');
const { auth } = require('../middleware/auth');

router.get('/', auth, getUserAddresses);
router.post('/', auth, createAddress);
router.put('/:id', auth, updateAddress);
router.delete('/:id', auth, deleteAddress);
router.patch('/:id/set-default', auth, setDefaultAddress);

module.exports = router;

