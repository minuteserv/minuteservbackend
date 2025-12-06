const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');
const crypto = require('crypto');

/**
 * Get all partners
 */
async function getAdminPartners(req, res) {
  try {
    const { status } = req.query;

    let query = supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data: partners, error } = await query;

    if (error) {
      logger.error('Get admin partners error:', error);
      throw new Error('Failed to fetch partners');
    }

    return successResponse(res, partners || []);
  } catch (error) {
    logger.error('Get admin partners error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get partner by ID
 */
async function getAdminPartnerById(req, res) {
  try {
    const { id } = req.params;

    const { data: partner, error } = await supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !partner) {
      return errorResponse(res, { message: 'Partner not found' }, 404);
    }

    return successResponse(res, partner);
  } catch (error) {
    logger.error('Get admin partner by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create partner
 */
async function createPartner(req, res) {
  try {
    const {
      name,
      phone_number,
      email,
      service_categories,
      is_active = true
    } = req.body;

    if (!name || !phone_number || !service_categories) {
      return errorResponse(res, { message: 'Name, phone number, and service categories are required' }, 400);
    }

    // Generate partner code
    const { count: partnerCount } = await supabase
      .from('partners')
      .select('*', { count: 'exact', head: true });

    const partnerCode = `PT-${String((partnerCount || 0) + 1).padStart(3, '0')}`;

    const { data: partner, error } = await supabase
      .from('partners')
      .insert({
        partner_code: partnerCode,
        name,
        phone_number,
        email: email || null,
        service_categories: Array.isArray(service_categories) ? service_categories : [service_categories],
        is_active,
        is_available: true
      })
      .select()
      .single();

    if (error) {
      logger.error('Create partner error:', error);
      throw new Error('Failed to create partner');
    }

    return successResponse(res, partner, 'Partner created successfully', 201);
  } catch (error) {
    logger.error('Create partner error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update partner
 */
async function updatePartner(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data: partner, error } = await supabase
      .from('partners')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update partner error:', error);
      throw new Error('Failed to update partner');
    }

    return successResponse(res, partner, 'Partner updated successfully');
  } catch (error) {
    logger.error('Update partner error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get partner performance stats
 */
async function getPartnerPerformance(req, res) {
  try {
    const { id } = req.params;

    // Get partner bookings stats
    const { data: bookings } = await supabase
      .from('bookings')
      .select('status, created_at, service_started_at, service_completed_at, assigned_at, accepted_at')
      .eq('partner_id', id);

    const totalBookings = bookings?.length || 0;
    const completedBookings = bookings?.filter(b => b.status === 'completed').length || 0;
    const cancelledBookings = bookings?.filter(b => b.status === 'cancelled').length || 0;
    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

    // Calculate average response time (time from assignment to acceptance)
    let avgResponseTime = 0;
    const responseTimes = bookings
      ?.filter(b => b.assigned_at && b.accepted_at)
      .map(b => {
        const assigned = new Date(b.assigned_at);
        const accepted = new Date(b.accepted_at);
        return (accepted - assigned) / (1000 * 60); // minutes
      }) || [];
    
    if (responseTimes.length > 0) {
      avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    // Get partner ratings from bookings
    const { data: ratings } = await supabase
      .from('bookings')
      .select('rating')
      .eq('partner_id', id)
      .not('rating', 'is', null);

    const avgRating = ratings?.length > 0
      ? ratings.reduce((sum, b) => sum + (parseFloat(b.rating) || 0), 0) / ratings.length
      : 0;

    // Get recent performance logs
    const { data: performanceLogs } = await supabase
      .from('partner_performance_logs')
      .select('*')
      .eq('partner_id', id)
      .order('logged_date', { ascending: false })
      .limit(30);

    return successResponse(res, {
      total_bookings: totalBookings,
      completed_bookings: completedBookings,
      cancelled_bookings: cancelledBookings,
      completion_rate: Math.round(completionRate * 100) / 100,
      average_response_time: Math.round(avgResponseTime),
      average_rating: Math.round(avgRating * 10) / 10,
      total_reviews: ratings?.length || 0,
      performance_logs: performanceLogs || [],
    });
  } catch (error) {
    logger.error('Get partner performance error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get partner payouts
 */
async function getPartnerPayouts(req, res) {
  try {
    const { id } = req.params;
    const { status, limit = 50 } = req.query;

    let query = supabase
      .from('partner_payouts')
      .select('*')
      .eq('partner_id', id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) {
      query = query.eq('status', status);
    }

    const { data: payouts, error } = await query;

    if (error) {
      logger.error('Get partner payouts error:', error);
      throw new Error('Failed to fetch payouts');
    }

    // Calculate pending payout amount
    const { data: pendingPayouts } = await supabase
      .from('partner_payouts')
      .select('amount')
      .eq('partner_id', id)
      .eq('status', 'pending');

    const pendingAmount = pendingPayouts?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    return successResponse(res, {
      payouts: payouts || [],
      pending_amount: pendingAmount,
    });
  } catch (error) {
    logger.error('Get partner payouts error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Process partner payout
 */
async function processPartnerPayout(req, res) {
  try {
    const { id } = req.params;
    const { payout_id, transaction_id, bank_reference_number, notes } = req.body;

    if (!payout_id) {
      return errorResponse(res, { message: 'Payout ID is required' }, 400);
    }

    // Get payout
    const { data: payout, error: payoutError } = await supabase
      .from('partner_payouts')
      .select('*')
      .eq('id', payout_id)
      .eq('partner_id', id)
      .single();

    if (payoutError || !payout) {
      return errorResponse(res, { message: 'Payout not found' }, 404);
    }

    if (payout.status !== 'pending') {
      return errorResponse(res, { message: 'Payout is not pending' }, 400);
    }

    // Update payout status
    const { data: updatedPayout, error: updateError } = await supabase
      .from('partner_payouts')
      .update({
        status: 'completed',
        transaction_id: transaction_id || null,
        bank_reference_number: bank_reference_number || null,
        notes: notes || null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payout_id)
      .select()
      .single();

    if (updateError) {
      logger.error('Process payout error:', updateError);
      throw new Error('Failed to process payout');
    }

    // Update partner's pending payout
    const { data: partner } = await supabase
      .from('partners')
      .select('pending_payout')
      .eq('id', id)
      .single();

    const newPendingPayout = Math.max(0, (partner?.pending_payout || 0) - payout.amount);

    await supabase
      .from('partners')
      .update({
        pending_payout: newPendingPayout,
        total_earnings: (partner?.total_earnings || 0) + payout.amount,
      })
      .eq('id', id);

    logger.info(`Payout ${payout_id} processed for partner ${id}`);

    return successResponse(res, {
      payout: updatedPayout,
      message: 'Payout processed successfully',
    });
  } catch (error) {
    logger.error('Process partner payout error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Upload partner document
 */
async function uploadPartnerDocument(req, res) {
  try {
    const { id } = req.params;
    const { document_type, document_url, document_name } = req.body;

    if (!document_type || !document_url) {
      return errorResponse(res, { message: 'Document type and URL are required' }, 400);
    }

    // Get partner
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('documents')
      .eq('id', id)
      .single();

    if (partnerError || !partner) {
      return errorResponse(res, { message: 'Partner not found' }, 404);
    }

    // Add document to documents array
    const documents = Array.isArray(partner.documents) ? partner.documents : [];
    const newDocument = {
      id: crypto.randomUUID(),
      type: document_type, // 'id_proof', 'certificate', 'photo', 'pan', 'aadhaar'
      url: document_url,
      name: document_name || document_type,
      uploaded_at: new Date().toISOString(),
    };

    documents.push(newDocument);

    // Update partner
    const { data: updatedPartner, error: updateError } = await supabase
      .from('partners')
      .update({
        documents: documents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Upload document error:', updateError);
      throw new Error('Failed to upload document');
    }

    return successResponse(res, {
      partner: updatedPartner,
      document: newDocument,
      message: 'Document uploaded successfully',
    });
  } catch (error) {
    logger.error('Upload partner document error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update partner availability schedule
 */
async function updatePartnerAvailability(req, res) {
  try {
    const { id } = req.params;
    const { availability_schedule } = req.body;

    if (!availability_schedule) {
      return errorResponse(res, { message: 'Availability schedule is required' }, 400);
    }

    const { data: partner, error } = await supabase
      .from('partners')
      .update({
        availability_schedule: availability_schedule,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update availability error:', error);
      throw new Error('Failed to update availability');
    }

    return successResponse(res, partner, 'Availability updated successfully');
  } catch (error) {
    logger.error('Update partner availability error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get all partners with enhanced stats
 */
async function getAdminPartnersEnhanced(req, res) {
  try {
    const { status, search } = req.query;

    let query = supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,partner_code.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    const { data: partners, error } = await query;

    if (error) {
      logger.error('Get admin partners error:', error);
      throw new Error('Failed to fetch partners');
    }

    // Enhance with booking stats
    const partnersWithStats = await Promise.all(
      (partners || []).map(async (partner) => {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('status, grand_total, partner_payout')
          .eq('partner_id', partner.id);

        const totalBookings = bookings?.length || 0;
        const completedBookings = bookings?.filter(b => b.status === 'completed').length || 0;
        const totalEarnings = bookings?.reduce((sum, b) => sum + parseFloat(b.partner_payout || 0), 0) || 0;
        const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

        return {
          ...partner,
          stats: {
            total_bookings: totalBookings,
            completed_bookings: completedBookings,
            completion_rate: Math.round(completionRate * 100) / 100,
            total_earnings: totalEarnings,
          },
        };
      })
    );

    return successResponse(res, partnersWithStats);
  } catch (error) {
    logger.error('Get admin partners enhanced error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getAdminPartners,
  getAdminPartnersEnhanced,
  getAdminPartnerById,
  createPartner,
  updatePartner,
  getPartnerPerformance,
  getPartnerPayouts,
  processPartnerPayout,
  uploadPartnerDocument,
  updatePartnerAvailability,
};

