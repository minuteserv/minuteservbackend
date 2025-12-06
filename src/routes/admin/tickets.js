const express = require('express');
const router = express.Router();
const {
  getAllTickets,
  getTicketStats,
  getTicketById,
  createTicket,
  updateTicket,
  addTicketResponse,
  getResponseTemplates,
  deleteTicket,
} = require('../../controllers/admin/ticketController');
const { adminAuth } = require('../../middleware/adminAuth');

// All routes require admin authentication
router.use(adminAuth);

// Stats & Templates (must be before /:id routes)
router.get('/stats', getTicketStats);
router.get('/templates', getResponseTemplates);

// CRUD operations
router.get('/', getAllTickets);
router.get('/:id', getTicketById);
router.post('/', createTicket);
router.patch('/:id', updateTicket);
router.delete('/:id', deleteTicket);

// Ticket responses
router.post('/:id/responses', addTicketResponse);

module.exports = router;

