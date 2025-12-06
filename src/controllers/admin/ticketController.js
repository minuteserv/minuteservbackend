const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Get all tickets with filters
 */
async function getAllTickets(req, res) {
  try {
    const { status, priority, category, search, limit = 100 } = req.query;

    let query = supabase
      .from('tickets')
      .select(`
        *,
        users(id, name, phone_number),
        bookings(id, booking_number)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`ticket_number.ilike.%${search}%,subject.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
    }

    const { data: tickets, error } = await query;

    if (error) {
      logger.error('Get tickets error:', error);
      throw new Error('Failed to fetch tickets');
    }

    return successResponse(res, tickets || []);
  } catch (error) {
    logger.error('Get tickets error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get ticket stats
 */
async function getTicketStats(req, res) {
  try {
    // Total tickets
    const { count: totalCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });

    // Open tickets
    const { count: openCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    // In Progress tickets
    const { count: inProgressCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress');

    // Resolved tickets
    const { count: resolvedCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved');

    // Critical priority
    const { count: criticalCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('priority', 'critical')
      .in('status', ['open', 'in_progress']);

    // Today's tickets
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Average resolution time (resolved tickets from last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: resolvedTickets } = await supabase
      .from('tickets')
      .select('created_at, resolved_at')
      .eq('status', 'resolved')
      .not('resolved_at', 'is', null)
      .gte('resolved_at', thirtyDaysAgo.toISOString());

    let avgResolutionHours = 0;
    if (resolvedTickets && resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.created_at);
        const resolved = new Date(t.resolved_at);
        return sum + (resolved - created) / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round(totalHours / resolvedTickets.length);
    }

    return successResponse(res, {
      total: totalCount || 0,
      open: openCount || 0,
      in_progress: inProgressCount || 0,
      resolved: resolvedCount || 0,
      critical: criticalCount || 0,
      today: todayCount || 0,
      avg_resolution_hours: avgResolutionHours,
    });
  } catch (error) {
    logger.error('Get ticket stats error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get single ticket with responses
 */
async function getTicketById(req, res) {
  try {
    const { id } = req.params;

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select(`
        *,
        users(id, name, phone_number, email),
        bookings(id, booking_number, status, grand_total, booking_date, booking_time)
      `)
      .eq('id', id)
      .single();

    if (error || !ticket) {
      return errorResponse(res, { message: 'Ticket not found' }, 404);
    }

    // Get responses
    const { data: responses } = await supabase
      .from('ticket_responses')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    return successResponse(res, {
      ...ticket,
      responses: responses || [],
    });
  } catch (error) {
    logger.error('Get ticket by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create new ticket
 */
async function createTicket(req, res) {
  try {
    const {
      user_id,
      customer_name,
      customer_phone,
      customer_email,
      subject,
      description,
      category = 'general',
      booking_id,
      partner_id,
      priority = 'medium',
      source = 'admin',
    } = req.body;

    if (!subject || !description) {
      return errorResponse(res, { message: 'Subject and description are required' }, 400);
    }

    // Calculate SLA due time based on priority
    const slaDurations = {
      critical: 4,    // 4 hours
      high: 12,       // 12 hours
      medium: 24,     // 24 hours
      low: 48,        // 48 hours
    };

    const slaDueAt = new Date();
    slaDueAt.setHours(slaDueAt.getHours() + slaDurations[priority]);

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        user_id,
        customer_name,
        customer_phone,
        customer_email,
        subject,
        description,
        category,
        booking_id,
        partner_id,
        priority,
        source,
        sla_due_at: slaDueAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Create ticket error:', error);
      throw new Error('Failed to create ticket');
    }

    logger.info(`Ticket created: ${ticket.ticket_number}`);
    return successResponse(res, ticket, 'Ticket created successfully', 201);
  } catch (error) {
    logger.error('Create ticket error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update ticket
 */
async function updateTicket(req, res) {
  try {
    const { id } = req.params;
    const {
      status,
      priority,
      assigned_to,
      category,
      subject,
      description,
    } = req.body;

    const updates = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (category) updates.category = category;
    if (subject) updates.subject = subject;
    if (description) updates.description = description;

    // Track status changes
    if (status === 'resolved' || status === 'closed') {
      updates.resolved_at = new Date().toISOString();
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update ticket error:', error);
      throw new Error('Failed to update ticket');
    }

    if (!ticket) {
      return errorResponse(res, { message: 'Ticket not found' }, 404);
    }

    // Add status change as a response
    if (status) {
      await supabase
        .from('ticket_responses')
        .insert({
          ticket_id: id,
          message: `Status changed to "${status}"`,
          response_type: 'status_change',
          responder_type: 'admin',
          responder_name: 'Admin',
        });
    }

    return successResponse(res, ticket, 'Ticket updated successfully');
  } catch (error) {
    logger.error('Update ticket error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Add response to ticket
 */
async function addTicketResponse(req, res) {
  try {
    const { id } = req.params;
    const { message, response_type = 'reply', responder_name = 'Admin' } = req.body;

    if (!message) {
      return errorResponse(res, { message: 'Message is required' }, 400);
    }

    // Check if ticket exists
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, first_response_at')
      .eq('id', id)
      .single();

    if (!ticket) {
      return errorResponse(res, { message: 'Ticket not found' }, 404);
    }

    // Add response
    const { data: response, error } = await supabase
      .from('ticket_responses')
      .insert({
        ticket_id: id,
        message,
        response_type,
        responder_type: 'admin',
        responder_name,
      })
      .select()
      .single();

    if (error) {
      logger.error('Add ticket response error:', error);
      throw new Error('Failed to add response');
    }

    // Update first response time if not set
    if (!ticket.first_response_at) {
      await supabase
        .from('tickets')
        .update({ 
          first_response_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', id);
    }

    return successResponse(res, response, 'Response added successfully', 201);
  } catch (error) {
    logger.error('Add ticket response error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get response templates
 */
async function getResponseTemplates(req, res) {
  try {
    const { data: templates, error } = await supabase
      .from('response_templates')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      logger.error('Get response templates error:', error);
      throw new Error('Failed to fetch templates');
    }

    return successResponse(res, templates || []);
  } catch (error) {
    logger.error('Get response templates error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Delete ticket
 */
async function deleteTicket(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Delete ticket error:', error);
      throw new Error('Failed to delete ticket');
    }

    return successResponse(res, null, 'Ticket deleted successfully');
  } catch (error) {
    logger.error('Delete ticket error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAllTickets,
  getTicketStats,
  getTicketById,
  createTicket,
  updateTicket,
  addTicketResponse,
  getResponseTemplates,
  deleteTicket,
};

