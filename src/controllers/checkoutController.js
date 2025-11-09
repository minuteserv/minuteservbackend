const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/response');
const { validatePromoCode } = require('../services/promoService');
const { calculatePricing } = require('../utils/pricing');
const { generateTimeSlots } = require('../utils/timeSlots');
const logger = require('../utils/logger');

/**
 * Prepare checkout (step 1)
 * Returns pricing, validated promo code, and available time slots
 */
async function prepareCheckout(req, res) {
  try {
    const { service_ids, promo_code, address_id, booking_date } = req.body;
    const userId = req.user.id;

    if (!service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
      return errorResponse(res, { message: 'Service IDs are required' }, 400);
    }

    // Fetch services
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .in('id', service_ids)
      .eq('is_active', true);

    if (servicesError || !services || services.length === 0) {
      return errorResponse(res, { message: 'Invalid services or services not found' }, 404);
    }

    // Prepare services with quantity (default 1)
    const servicesWithQuantity = services.map(service => ({
      service_id: service.id,
      name: service.name,
      category: service.category,
      tier: service.tier,
      product_cost: parseFloat(service.product_cost),
      market_price: service.market_price ? parseFloat(service.market_price) : null,
      quantity: 1
    }));

    // Calculate pricing without promo
    const pricingWithoutPromo = calculatePricing(servicesWithQuantity);

    // Validate promo code
    let promoResult = { valid: false, discount: 0 };
    if (promo_code) {
      promoResult = await validatePromoCode(
        promo_code,
        pricingWithoutPromo.subtotal,
        userId
      );
    }

    // Calculate final pricing with promo
    const finalPricing = calculatePricing(
      servicesWithQuantity,
      promoResult.discount
    );

    // Get address if provided
    let address = null;
    if (address_id) {
      const { data: addressData } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('id', address_id)
        .eq('user_id', userId)
        .single();

      address = addressData;
    }

    // Generate preview ID (2 min TTL)
    const previewId = `preview_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return successResponse(res, {
      preview_id: previewId,
      services: servicesWithQuantity,
      pricing: {
        subtotal: finalPricing.subtotal,
        savings: finalPricing.savings,
        discount: finalPricing.discount,
        tax: finalPricing.tax,
        grand_total: finalPricing.grand_total
      },
      promo: {
        code: promoResult.valid ? promo_code : null,
        discount: promoResult.discount,
        valid: promoResult.valid,
        message: promoResult.message
      },
      available_time_slots: generateTimeSlots(),
      address
    });
  } catch (error) {
    logger.error('Prepare checkout error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Confirm booking (step 2)
 * Creates booking and payment order
 */
async function confirmBooking(req, res) {
  try {
    const {
      preview_id,
      payment_method,
      address_id,
      booking_date,
      booking_time,
      customer_name,
      customer_phone,
      customer_email,
      services, // Array of {service_id, quantity}
      promo_code,
      cancellation_policy_accepted
    } = req.body;

    const userId = req.user.id;

    // Validation
    if (!payment_method || !['cash', 'online'].includes(payment_method)) {
      return errorResponse(res, { message: 'Invalid payment method' }, 400);
    }

    if (!address_id || !booking_date || !booking_time) {
      return errorResponse(res, { message: 'Address, booking date, and time are required' }, 400);
    }

    if (!services || !Array.isArray(services) || services.length === 0) {
      return errorResponse(res, { message: 'Services are required' }, 400);
    }

    // Validate services structure - each service must have service_id or id
    const invalidServices = services.filter(s => !s.service_id && !s.id);
    if (invalidServices.length > 0) {
      logger.error('Invalid services structure:', services);
      return errorResponse(res, { 
        message: 'Invalid services: Each service must have a service_id or id field',
        details: `Found ${invalidServices.length} service(s) without service_id. Services array: ${JSON.stringify(services)}`
      }, 400);
    }

    if (!customer_name || !customer_phone) {
      return errorResponse(res, { message: 'Customer name and phone are required' }, 400);
    }

    // Validate booking date (not in past)
    const bookingDate = new Date(booking_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      return errorResponse(res, { message: 'Booking date cannot be in the past' }, 400);
    }

    // Verify address belongs to user
    const { data: address, error: addressError } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('id', address_id)
      .eq('user_id', userId)
      .single();

    if (addressError || !address) {
      return errorResponse(res, { message: 'Address not found' }, 404);
    }

    // Extract service IDs - support both service_id and id fields
    const serviceIds = services.map(s => s.service_id || s.id).filter(Boolean);
    
    if (serviceIds.length === 0) {
      logger.error('No valid service IDs found:', services);
      return errorResponse(res, { 
        message: 'Invalid services: No valid service IDs found',
        details: `Services array: ${JSON.stringify(services)}`
      }, 400);
    }

    // Fetch services
    const { data: serviceData, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .in('id', serviceIds)
      .eq('is_active', true);

    if (servicesError) {
      logger.error('Error fetching services:', servicesError);
      return errorResponse(res, { message: 'Failed to fetch services', error: servicesError.message }, 500);
    }

    if (!serviceData || serviceData.length === 0) {
      logger.error('No services found for IDs:', serviceIds);
      return errorResponse(res, { 
        message: 'Invalid services: No active services found for the provided service IDs',
        details: `Requested service IDs: ${JSON.stringify(serviceIds)}`
      }, 404);
    }

    if (serviceData.length !== serviceIds.length) {
      const foundIds = serviceData.map(s => s.id);
      const missingIds = serviceIds.filter(id => !foundIds.includes(id));
      logger.error('Some services not found:', { requested: serviceIds, found: foundIds, missing: missingIds });
      return errorResponse(res, { 
        message: 'Invalid services: Some services were not found or are inactive',
        details: `Missing service IDs: ${JSON.stringify(missingIds)}`
      }, 400);
    }

    // Prepare services JSON
    const servicesJson = serviceData.map(service => {
      // Find matching service request - support both service_id and id fields
      const serviceRequest = services.find(s => 
        (s.service_id === service.id) || (s.id === service.id)
      );
      return {
        service_id: service.id,
        name: service.name,
        category: service.category,
        tier: service.tier,
        quantity: serviceRequest?.quantity || 1,
        price: parseFloat(service.product_cost || service.price || 0),
        product_cost: parseFloat(service.product_cost || service.price || 0),
        market_price: service.market_price ? parseFloat(service.market_price) : null
      };
    });

    // Calculate pricing
    let promoDiscount = 0;
    if (promo_code) {
      const promoResult = await validatePromoCode(promo_code, 0, userId);
      if (promoResult.valid) {
        const pricingWithoutPromo = calculatePricing(servicesJson);
        const promoResultWithAmount = await validatePromoCode(
          promo_code,
          pricingWithoutPromo.subtotal,
          userId
        );
        promoDiscount = promoResultWithAmount.discount;
      }
    }

    const pricing = calculatePricing(servicesJson, promoDiscount);

    // Validate pricing
    if (!pricing || typeof pricing.subtotal !== 'number' || typeof pricing.grand_total !== 'number') {
      logger.error('Invalid pricing calculation:', pricing);
      return errorResponse(res, { message: 'Failed to calculate pricing' }, 500);
    }

    // Generate booking number
    const { generateBookingNumber } = require('../utils/bookingNumber');
    const bookingNumber = generateBookingNumber();

    // Calculate partner payout (70% of grand total)
    const partnerPayout = Math.floor(pricing.grand_total * 0.70 * 100) / 100;

    // Create booking
    // Note: Supabase JSONB field accepts JSON object directly
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        booking_number: bookingNumber,
        user_id: userId,
        address_id: address_id,
        services: servicesJson, // JSONB accepts JSON object
        booking_date: booking_date,
        booking_time: booking_time,
        payment_method: payment_method,
        payment_status: 'pending',
        total_price: pricing.subtotal || 0,
        discount: pricing.discount || 0,
        tax: pricing.tax || 0,
        grand_total: pricing.grand_total || 0,
        partner_payout: partnerPayout,
        promo_code: promo_code || null,
        customer_name: customer_name,
        customer_phone: customer_phone,
        customer_email: customer_email || null,
        status: 'pending',
        cancellation_policy_accepted: cancellation_policy_accepted || false
      })
      .select()
      .single();

    if (bookingError) {
      logger.error('Create booking error:', {
        message: bookingError.message,
        details: bookingError.details,
        hint: bookingError.hint,
        code: bookingError.code,
        fullError: bookingError
      });
      // Return detailed error for debugging
      const errorDetails = {
        message: 'Failed to create booking',
        error: bookingError.message,
        code: bookingError.code,
        details: bookingError.details,
        hint: bookingError.hint
      };
      
      logger.error('Create booking error details:', errorDetails);
      
      return errorResponse(res, errorDetails, 500);
    }

    // Handle payment based on method
    if (payment_method === 'online') {
      // Check if Razorpay is configured
      const isRazorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
      
      if (!isRazorpayConfigured) {
        // Development mode: Create payment record without Razorpay order
        logger.warn('Razorpay not configured. Creating booking with pending payment (development mode).');
        
        // Store payment record without Razorpay order ID
        await supabase
          .from('payments')
          .insert({
            booking_id: booking.id,
            razorpay_order_id: null,
            amount: pricing.grand_total,
            status: 'pending',
            payment_method: 'online'
          });

        return successResponse(res, {
          booking: {
            id: booking.id,
            booking_number: bookingNumber,
            status: 'pending',
            payment_status: 'pending'
          },
          payment: {
            order_id: null,
            amount: pricing.grand_total,
            currency: 'INR',
            message: 'Razorpay not configured. Payment will be processed manually in development mode.',
            development_mode: true
          },
          warning: 'Razorpay keys not configured. This booking is in development mode.'
        }, 'Booking created successfully (development mode)', 201);
      }

      // Production mode: Create Razorpay order
      const { createOrder } = require('../services/razorpayService');
      
      try {
        const orderResult = await createOrder(
          pricing.grand_total,
          bookingNumber,
          {
            booking_id: booking.id,
            booking_number: bookingNumber
          }
        );

        // Store payment record
        await supabase
          .from('payments')
          .insert({
            booking_id: booking.id,
            razorpay_order_id: orderResult.order_id,
            amount: pricing.grand_total,
            status: 'pending',
            payment_method: 'online'
          });

        // Update booking with order ID
        await supabase
          .from('bookings')
          .update({ razorpay_order_id: orderResult.order_id })
          .eq('id', booking.id);

        return successResponse(res, {
          booking: {
            id: booking.id,
            booking_number: bookingNumber,
            status: 'pending',
            payment_status: 'pending'
          },
          payment: {
            order_id: orderResult.order_id,
            amount: orderResult.amount,
            currency: orderResult.currency,
            key: process.env.RAZORPAY_KEY_ID,
            name: 'Minuteserv',
            description: `Booking ${bookingNumber}`,
            prefill: {
              contact: customer_phone,
              email: customer_email || '',
              name: customer_name
            },
            notes: {
              booking_id: booking.id,
              booking_number: bookingNumber
            }
          }
        }, 'Booking created successfully', 201);
      } catch (paymentError) {
        logger.error('Create payment order error:', paymentError);
        // Booking already created, but payment order failed
        return successResponse(res, {
          booking: {
            id: booking.id,
            booking_number: bookingNumber,
            status: 'pending',
            payment_status: 'pending'
          },
          message: 'Booking created. Payment order creation failed. Please contact support.'
        }, 'Booking created but payment setup failed', 201);
      }
    } else {
      // Cash payment - trigger partner assignment
      // Partner assignment will be handled separately
      return successResponse(res, {
        booking: {
          id: booking.id,
          booking_number: bookingNumber,
          status: 'pending',
          payment_status: 'pending'
        },
        message: 'Booking created. Partner will be assigned shortly.'
      }, 'Booking created successfully', 201);
    }
  } catch (error) {
    logger.error('Confirm booking error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  prepareCheckout,
  confirmBooking
};

