const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Submit contact form
 */
async function submitContact(req, res) {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return errorResponse(res, { message: 'Name, email, and message are required' }, 400);
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, { message: 'Invalid email format' }, 400);
    }

    const { data: submission, error } = await supabase
      .from('contact_submissions')
      .insert({
        name,
        email,
        phone: phone || null,
        message,
        status: 'new'
      })
      .select()
      .single();

    if (error) {
      logger.error('Submit contact error:', error);
      throw new Error('Failed to submit contact form');
    }

    return successResponse(res, submission, 'Thank you for contacting us. We\'ll get back to you soon.', 201);
  } catch (error) {
    logger.error('Submit contact error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  submitContact
};

