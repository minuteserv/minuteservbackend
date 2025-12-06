const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Get Payouts Dashboard
 */
async function getPayoutsDashboard(req, res) {
  try {
    // Get pending payouts summary
    const { data: pendingPayouts, error: pendingError } = await supabase
      .from('partner_payouts')
      .select('amount, partner_id')
      .eq('status', 'pending');

    if (pendingError) throw pendingError;

    const totalPendingAmount = pendingPayouts?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
    const pendingCount = pendingPayouts?.length || 0;

    // Get completed payouts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: completedPayouts, error: completedError } = await supabase
      .from('partner_payouts')
      .select('amount')
      .eq('status', 'completed')
      .gte('processed_at', startOfMonth.toISOString());

    if (completedError) throw completedError;

    const totalCompletedAmount = completedPayouts?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
    const completedCount = completedPayouts?.length || 0;

    // Get partners with pending payouts
    const { data: partnersWithPending, error: partnersError } = await supabase
      .from('partners')
      .select('id, name, pending_payout')
      .gt('pending_payout', 0)
      .order('pending_payout', { ascending: false })
      .limit(10);

    if (partnersError) throw partnersError;

    // Get recent payouts
    const { data: recentPayouts, error: recentError } = await supabase
      .from('partner_payouts')
      .select(`
        *,
        partners:partner_id (
          id,
          name,
          partner_code
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    return successResponse(res, {
      stats: {
        total_pending_amount: totalPendingAmount,
        pending_count: pendingCount,
        total_completed_amount: totalCompletedAmount,
        completed_count: completedCount,
      },
      partners_with_pending: partnersWithPending || [],
      recent_payouts: recentPayouts || [],
    });
  } catch (error) {
    logger.error('Get payouts dashboard error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get Pending Payouts
 */
async function getPendingPayouts(req, res) {
  try {
    const { partner_id, min_amount, max_amount, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('partner_payouts')
      .select(`
        *,
        partners:partner_id (
          id,
          name,
          partner_code,
          phone_number,
          bank_account_number,
          bank_ifsc,
          bank_name,
          account_holder_name
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (partner_id) {
      query = query.eq('partner_id', partner_id);
    }

    if (min_amount) {
      query = query.gte('amount', parseFloat(min_amount));
    }

    if (max_amount) {
      query = query.lte('amount', parseFloat(max_amount));
    }

    const { data: payouts, error } = await query;

    if (error) throw error;

    // Get total count
    let countQuery = supabase
      .from('partner_payouts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (partner_id) {
      countQuery = countQuery.eq('partner_id', partner_id);
    }

    const { count, error: countError } = await countQuery;

    if (countError) throw countError;

    return successResponse(res, {
      payouts: payouts || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Get pending payouts error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get Payout History
 */
async function getPayoutHistory(req, res) {
  try {
    const {
      partner_id,
      status,
      period_start,
      period_end,
      limit = 50,
      offset = 0,
    } = req.query;

    let query = supabase
      .from('partner_payouts')
      .select(`
        *,
        partners:partner_id (
          id,
          name,
          partner_code
        ),
        payout_batches:batch_id (
          id,
          batch_number,
          batch_date
        )
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (partner_id) {
      query = query.eq('partner_id', partner_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (period_start) {
      query = query.gte('period_start', period_start);
    }

    if (period_end) {
      query = query.lte('period_end', period_end);
    }

    const { data: payouts, error } = await query;

    if (error) throw error;

    // Get total count
    let countQuery = supabase
      .from('partner_payouts')
      .select('*', { count: 'exact', head: true });

    if (partner_id) {
      countQuery = countQuery.eq('partner_id', partner_id);
    }

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    const { count, error: countError } = await countQuery;

    if (countError) throw countError;

    return successResponse(res, {
      payouts: payouts || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Get payout history error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get Payout by ID
 */
async function getPayoutById(req, res) {
  try {
    const { id } = req.params;

    const { data: payout, error } = await supabase
      .from('partner_payouts')
      .select(`
        *,
        partners:partner_id (
          id,
          name,
          partner_code,
          phone_number,
          email,
          bank_account_number,
          bank_ifsc,
          bank_name,
          account_holder_name
        ),
        payout_batches:batch_id (
          id,
          batch_number,
          batch_date
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!payout) {
      return errorResponse(res, { message: 'Payout not found' }, 404);
    }

    return successResponse(res, { payout });
  } catch (error) {
    logger.error('Get payout by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Process Batch Payouts
 */
async function processBatchPayouts(req, res) {
  try {
    const { payout_ids, payment_method, transaction_id, bank_reference_number, notes } = req.body;

    if (!payout_ids || !Array.isArray(payout_ids) || payout_ids.length === 0) {
      return errorResponse(res, { message: 'Payout IDs are required' }, 400);
    }

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .insert({
        payment_method: payment_method || 'bank_transfer',
        transaction_id: transaction_id || null,
        bank_reference_number: bank_reference_number || null,
        notes: notes || null,
        status: 'processing',
        total_partners: payout_ids.length,
      })
      .select()
      .single();

    if (batchError) throw batchError;

    // Calculate total amount
    const { data: payouts, error: payoutsError } = await supabase
      .from('partner_payouts')
      .select('amount')
      .in('id', payout_ids)
      .eq('status', 'pending');

    if (payoutsError) throw payoutsError;

    const totalAmount = payouts?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Update batch with total amount
    await supabase
      .from('payout_batches')
      .update({ total_amount: totalAmount })
      .eq('id', batch.id);

    // Update all payouts
    const { data: updatedPayouts, error: updateError } = await supabase
      .from('partner_payouts')
      .update({
        status: 'completed',
        batch_id: batch.id,
        transaction_id: transaction_id || null,
        bank_reference_number: bank_reference_number || null,
        notes: notes || null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', payout_ids)
      .select();

    if (updateError) throw updateError;

    // Update partner pending payouts
    const partnerIds = [...new Set(updatedPayouts?.map(p => p.partner_id) || [])];
    
    for (const partnerId of partnerIds) {
      const partnerPayouts = updatedPayouts?.filter(p => p.partner_id === partnerId) || [];
      const totalPayoutAmount = partnerPayouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      // Get current partner data
      const { data: partner } = await supabase
        .from('partners')
        .select('pending_payout, total_earnings')
        .eq('id', partnerId)
        .single();

      if (partner) {
        await supabase
          .from('partners')
          .update({
            pending_payout: Math.max(0, (partner.pending_payout || 0) - totalPayoutAmount),
            total_earnings: (partner.total_earnings || 0) + totalPayoutAmount,
          })
          .eq('id', partnerId);
      }
    }

    // Update batch status
    await supabase
      .from('payout_batches')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', batch.id);

    logger.info(`Batch payout ${batch.batch_number} processed: ${payout_ids.length} payouts, ₹${totalAmount}`);

    return successResponse(res, {
      batch,
      payouts: updatedPayouts,
      message: 'Batch payout processed successfully',
    });
  } catch (error) {
    logger.error('Process batch payouts error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Calculate Commissions
 */
async function calculateCommissions(req, res) {
  try {
    const { partner_id, period_start, period_end } = req.body;

    if (!period_start || !period_end) {
      return errorResponse(res, { message: 'Period start and end dates are required' }, 400);
    }

    let query = supabase
      .from('bookings')
      .select('id, partner_id, grand_total, status, created_at')
      .eq('status', 'completed')
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    if (partner_id) {
      query = query.eq('partner_id', partner_id);
    }

    const { data: bookings, error } = await query;

    if (error) throw error;

    const calculations = [];

    for (const booking of bookings || []) {
      // Check if commission already calculated
      const { data: existing } = await supabase
        .from('commission_calculations')
        .select('id')
        .eq('booking_id', booking.id)
        .eq('status', 'calculated')
        .single();

      if (existing) continue;

      // Get partner commission rate
      const { data: partner } = await supabase
        .from('partners')
        .select('commission_rate')
        .eq('id', booking.partner_id)
        .single();

      const commissionRate = partner?.commission_rate || 70.00;
      const commissionAmount = (booking.grand_total * commissionRate) / 100;

      // Insert commission calculation
      const { data: calculation, error: calcError } = await supabase
        .from('commission_calculations')
        .insert({
          partner_id: booking.partner_id,
          booking_id: booking.id,
          booking_amount: booking.grand_total,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          status: 'calculated',
          calculated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (calcError) {
        logger.error(`Error calculating commission for booking ${booking.id}:`, calcError);
        continue;
      }

      calculations.push(calculation);

      // Update partner pending payout
      const { data: currentPartner } = await supabase
        .from('partners')
        .select('pending_payout')
        .eq('id', booking.partner_id)
        .single();

      if (currentPartner) {
        await supabase
          .from('partners')
          .update({
            pending_payout: (currentPartner.pending_payout || 0) + commissionAmount,
          })
          .eq('id', booking.partner_id);
      }
    }

    return successResponse(res, {
      calculations,
      total_calculated: calculations.length,
      message: 'Commissions calculated successfully',
    });
  } catch (error) {
    logger.error('Calculate commissions error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get Commission Calculations
 */
async function getCommissionCalculations(req, res) {
  try {
    const { partner_id, status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('commission_calculations')
      .select(`
        *,
        partners:partner_id (
          id,
          name,
          partner_code
        ),
        bookings:booking_id (
          id,
          booking_number,
          grand_total
        )
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (partner_id) {
      query = query.eq('partner_id', partner_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: calculations, error } = await query;

    if (error) throw error;

    return successResponse(res, {
      calculations: calculations || [],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Get commission calculations error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Generate Invoice
 */
async function generateInvoice(req, res) {
  try {
    const { payout_id, partner_id, period_start, period_end } = req.body;

    if (!partner_id || !period_start || !period_end) {
      return errorResponse(res, { message: 'Partner ID, period start and end are required' }, 400);
    }

    // Get partner details
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('*')
      .eq('id', partner_id)
      .single();

    if (partnerError || !partner) {
      return errorResponse(res, { message: 'Partner not found' }, 404);
    }

    // Get payouts for the period
    let payoutQuery = supabase
      .from('partner_payouts')
      .select('*')
      .eq('partner_id', partner_id)
      .gte('period_start', period_start)
      .lte('period_end', period_end);

    if (payout_id) {
      payoutQuery = payoutQuery.eq('id', payout_id);
    }

    const { data: payouts, error: payoutsError } = await payoutQuery;

    if (payoutsError) throw payoutsError;

    if (!payouts || payouts.length === 0) {
      return errorResponse(res, { message: 'No payouts found for the period' }, 404);
    }

    // Calculate totals
    const subtotal = payouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const gstRate = 18.00; // Default GST rate
    const gstAmount = (subtotal * gstRate) / 100;
    const totalAmount = subtotal + gstAmount;

    // Get commission calculations for items
    const { data: commissions } = await supabase
      .from('commission_calculations')
      .select(`
        *,
        bookings:booking_id (
          id,
          booking_number,
          booking_date,
          grand_total
        )
      `)
      .eq('partner_id', partner_id)
      .in('payout_id', payouts.map(p => p.id).filter(Boolean))
      .eq('status', 'calculated');

    // Create invoice items
    const items = (commissions || []).map(comm => ({
      booking_number: comm.bookings?.booking_number || 'N/A',
      booking_date: comm.bookings?.booking_date || null,
      description: `Commission for booking ${comm.bookings?.booking_number || comm.booking_id}`,
      quantity: 1,
      unit_price: comm.commission_amount,
      total: comm.commission_amount,
    }));

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('partner_invoices')
      .insert({
        partner_id,
        payout_id: payout_id || null,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
        subtotal,
        gst_amount: gstAmount,
        gst_rate: gstRate,
        total_amount: totalAmount,
        period_start,
        period_end,
        items,
        status: 'draft',
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    return successResponse(res, {
      invoice,
      message: 'Invoice generated successfully',
    });
  } catch (error) {
    logger.error('Generate invoice error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get Invoices
 */
async function getInvoices(req, res) {
  try {
    const { partner_id, status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('partner_invoices')
      .select(`
        *,
        partners:partner_id (
          id,
          name,
          partner_code
        )
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (partner_id) {
      query = query.eq('partner_id', partner_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: invoices, error } = await query;

    if (error) throw error;

    return successResponse(res, {
      invoices: invoices || [],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Get invoices error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get Invoice by ID
 */
async function getInvoiceById(req, res) {
  try {
    const { id } = req.params;

    const { data: invoice, error } = await supabase
      .from('partner_invoices')
      .select(`
        *,
        partners:partner_id (
          id,
          name,
          partner_code,
          phone_number,
          email,
          address,
          city,
          pincode,
          pan_number,
          gst_number
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!invoice) {
      return errorResponse(res, { message: 'Invoice not found' }, 404);
    }

    return successResponse(res, { invoice });
  } catch (error) {
    logger.error('Get invoice by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get P&L Dashboard
 */
async function getPLDashboard(req, res) {
  try {
    const { period_start, period_end } = req.query;

    const startDate = period_start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = period_end || new Date().toISOString().split('T')[0];

    // Get revenue from bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('grand_total, status, created_at')
      .eq('status', 'completed')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (bookingsError) throw bookingsError;

    const totalRevenue = bookings?.reduce((sum, b) => sum + parseFloat(b.grand_total || 0), 0) || 0;

    // Get partner payouts
    const { data: payouts, error: payoutsError } = await supabase
      .from('partner_payouts')
      .select('amount')
      .eq('status', 'completed')
      .gte('processed_at', startDate)
      .lte('processed_at', endDate);

    if (payoutsError) throw payoutsError;

    const partnerPayouts = payouts?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Get inventory costs (from stock movements)
    // Note: Using 'out' type movements (sales, adjustments, etc.) to calculate costs
    const { data: stockMovements, error: stockError } = await supabase
      .from('stock_movements')
      .select('total_cost')
      .in('movement_type', ['sale', 'adjustment', 'damaged', 'expiry'])
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (stockError) throw stockError;

    const inventoryCosts = stockMovements?.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0) || 0;

    // Calculate P&L
    const grossProfit = totalRevenue - partnerPayouts;
    const totalExpenses = partnerPayouts + inventoryCosts;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return successResponse(res, {
      period: {
        start: startDate,
        end: endDate,
      },
      revenue: {
        total: totalRevenue,
        service_revenue: totalRevenue,
        other_revenue: 0,
      },
      expenses: {
        partner_payouts: partnerPayouts,
        inventory_costs: inventoryCosts,
        marketing_costs: 0,
        operational_costs: 0,
        admin_costs: 0,
        other_expenses: 0,
        total: totalExpenses,
      },
      profit: {
        gross_profit: grossProfit,
        net_profit: netProfit,
        profit_margin: profitMargin,
      },
    });
  } catch (error) {
    logger.error('Get P&L dashboard error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get P&L Statements
 */
async function getPLStatements(req, res) {
  try {
    const { period_type, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('pl_statements')
      .select('*')
      .order('period_start', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (period_type) {
      query = query.eq('period_type', period_type);
    }

    const { data: statements, error } = await query;

    if (error) throw error;

    return successResponse(res, {
      statements: statements || [],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Get P&L statements error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get GST Reports
 */
async function getGSTReports(req, res) {
  try {
    const { period_type, status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('gst_reports')
      .select('*')
      .order('period_start', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (period_type) {
      query = query.eq('period_type', period_type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: reports, error } = await query;

    if (error) throw error;

    return successResponse(res, {
      reports: reports || [],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Get GST reports error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Generate GST Report
 */
async function generateGSTReport(req, res) {
  try {
    const { period_type, period_start, period_end } = req.body;

    if (!period_start || !period_end) {
      return errorResponse(res, { message: 'Period start and end dates are required' }, 400);
    }

    // Get revenue from bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('grand_total, created_at')
      .eq('status', 'completed')
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    if (bookingsError) throw bookingsError;

    const totalRevenue = bookings?.reduce((sum, b) => sum + parseFloat(b.grand_total || 0), 0) || 0;
    const taxableRevenue = totalRevenue; // Assuming all revenue is taxable
    const gstRate = 18.00;
    const totalGST = (taxableRevenue * gstRate) / 100;
    const cgst = totalGST / 2;
    const sgst = totalGST / 2;

    // Get partner payouts
    const { data: payouts, error: payoutsError } = await supabase
      .from('partner_payouts')
      .select('amount')
      .eq('status', 'completed')
      .gte('processed_at', period_start)
      .lte('processed_at', period_end);

    if (payoutsError) throw payoutsError;

    const totalPayouts = payouts?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
    const payoutGST = (totalPayouts * gstRate) / 100;

    const netPayable = totalGST - payoutGST;

    // Create GST report
    const { data: report, error: reportError } = await supabase
      .from('gst_reports')
      .insert({
        period_type: period_type || 'monthly',
        period_start,
        period_end,
        total_revenue,
        taxable_revenue,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: 0,
        total_gst: totalGST,
        total_payouts,
        payout_gst: payoutGST,
        net_revenue: totalRevenue - totalPayouts,
        net_payable,
        status: 'draft',
      })
      .select()
      .single();

    if (reportError) throw reportError;

    return successResponse(res, {
      report,
      message: 'GST report generated successfully',
    });
  } catch (error) {
    logger.error('Generate GST report error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get Reconciliation
 */
async function getReconciliation(req, res) {
  try {
    const { period_start, period_end, status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('payment_reconciliation')
      .select('*')
      .order('reconciliation_date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (period_start) {
      query = query.gte('period_start', period_start);
    }

    if (period_end) {
      query = query.lte('period_end', period_end);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: reconciliations, error } = await query;

    if (error) throw error;

    return successResponse(res, {
      reconciliations: reconciliations || [],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Get reconciliation error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Perform Reconciliation
 */
async function performReconciliation(req, res) {
  try {
    const { period_start, period_end } = req.body;

    if (!period_start || !period_end) {
      return errorResponse(res, { message: 'Period start and end dates are required' }, 400);
    }

    // Get expected revenue from bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('grand_total, payment_status, created_at')
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    if (bookingsError) throw bookingsError;

    const expectedRevenue = bookings?.reduce((sum, b) => {
      if (b.payment_status === 'paid' || b.payment_status === 'completed') {
        return sum + parseFloat(b.grand_total || 0);
      }
      return sum;
    }, 0) || 0;

    // Get actual revenue from payments
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('status', 'paid')
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    if (paymentsError) throw paymentsError;

    const actualRevenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Get expected payouts
    const { data: expectedPayouts, error: payoutsError } = await supabase
      .from('partner_payouts')
      .select('amount')
      .eq('status', 'completed')
      .gte('period_start', period_start)
      .lte('period_end', period_end);

    if (payoutsError) throw payoutsError;

    const expectedPayoutsAmount = expectedPayouts?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Get actual payouts (processed)
    const actualPayoutsAmount = expectedPayoutsAmount; // Same as expected for now

    const revenueVariance = actualRevenue - expectedRevenue;
    const payoutVariance = actualPayoutsAmount - expectedPayoutsAmount;

    // Find discrepancies
    const discrepancies = [];
    if (Math.abs(revenueVariance) > 0.01) {
      discrepancies.push({
        type: 'revenue',
        expected: expectedRevenue,
        actual: actualRevenue,
        variance: revenueVariance,
      });
    }

    if (Math.abs(payoutVariance) > 0.01) {
      discrepancies.push({
        type: 'payout',
        expected: expectedPayoutsAmount,
        actual: actualPayoutsAmount,
        variance: payoutVariance,
      });
    }

    // Create reconciliation record
    const { data: reconciliation, error: reconError } = await supabase
      .from('payment_reconciliation')
      .insert({
        period_start,
        period_end,
        expected_revenue: expectedRevenue,
        actual_revenue: actualRevenue,
        variance: revenueVariance,
        expected_payouts: expectedPayoutsAmount,
        actual_payouts: actualPayoutsAmount,
        payout_variance: payoutVariance,
        discrepancies,
        discrepancy_count: discrepancies.length,
        status: discrepancies.length > 0 ? 'in_progress' : 'completed',
      })
      .select()
      .single();

    if (reconError) throw reconError;

    return successResponse(res, {
      reconciliation,
      message: 'Reconciliation performed successfully',
    });
  } catch (error) {
    logger.error('Perform reconciliation error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getPayoutsDashboard,
  getPendingPayouts,
  getPayoutHistory,
  processBatchPayouts,
  getPayoutById,
  generateInvoice,
  getInvoices,
  getInvoiceById,
  getPLDashboard,
  getPLStatements,
  getGSTReports,
  generateGSTReport,
  getReconciliation,
  performReconciliation,
  calculateCommissions,
  getCommissionCalculations,
};

