const axios = require('axios');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const INTERAKT_BASE_URL = process.env.INTERAKT_BASE_URL || 'https://api.interakt.ai/v1/public';
const INTERAKT_API_KEY = process.env.INTERAKT_API_KEY;

/**
 * Interakt OTP Service
 * Handles OTP generation, storage, and verification with Interakt WhatsApp Templates
 * Uses 6-digit OTP for better security
 * Template name: "auth" (must be created in Facebook Business Manager and synced in Interakt)
 */

/**
 * Generate 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Normalize phone number to standard format (+91XXXXXXXXXX)
 * Handles various input formats and returns normalized phone number
 */
function normalizePhoneNumber(phoneNumber) {
  // Remove any spaces or dashes
  let cleaned = phoneNumber.replace(/[\s-]/g, '');
  
  // Normalize to +91XXXXXXXXXX format
  if (cleaned.startsWith('+91')) {
    return cleaned;
  } else if (cleaned.startsWith('91')) {
    return '+' + cleaned;
  } else if (cleaned.startsWith('0')) {
    return '+91' + cleaned.substring(1);
  } else {
    // Default to India
    return '+91' + cleaned;
  }
}

/**
 * Check if phone number is the test number (9999999999)
 */
function isTestPhoneNumber(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  return normalized === '+919999999999';
}

/**
 * Format phone number for Interakt API
 * Input: "+919876543210"
 * Output: { countryCode: "+91", phoneNumber: "9876543210" }
 */
function formatPhoneNumber(phoneNumber) {
  // Remove any spaces or dashes
  let cleaned = phoneNumber.replace(/[\s-]/g, '');
  
  // Extract country code (assume +91 for India)
  if (cleaned.startsWith('+91')) {
    return {
      countryCode: '+91',
      phoneNumber: cleaned.substring(3)
    };
  } else if (cleaned.startsWith('91')) {
    return {
      countryCode: '+91',
      phoneNumber: cleaned.substring(2)
    };
  } else if (cleaned.startsWith('0')) {
    return {
      countryCode: '+91',
      phoneNumber: cleaned.substring(1)
    };
  } else {
    // Default to India
    return {
      countryCode: '+91',
      phoneNumber: cleaned
    };
  }
}

/**
 * Send OTP via Interakt WhatsApp Template
 * Uses "auth" template with OTP in bodyValues and buttonValues
 * @param {string} phoneNumber - Full phone number with country code
 * @returns {Promise<Object>} Result with OTP code and expiry
 */
async function sendOTP(phoneNumber) {
  try {
    // Check rate limit (disabled in development/test, 3 per hour in production)
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    // Normalize phone number for consistent handling
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    
    if (!isDevelopment) {
      const maxOTPsPerHour = 3;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const { data: recentOTPs } = await supabase
        .from('otp_verifications')
        .select('id')
        .eq('phone_number', normalizedPhoneNumber)
        .gte('created_at', oneHourAgo.toISOString());

      if (recentOTPs && recentOTPs.length >= maxOTPsPerHour) {
        throw new Error(`OTP limit exceeded. Please try again after 1 hour. (${recentOTPs.length}/${maxOTPsPerHour} used)`);
      }
    } else {
      logger.info(`🔧 Development mode: Rate limiting disabled for testing`);
    }

    // Generate 6-digit OTP (use test OTP for test phone number)
    const otpCode = isTestPhoneNumber(normalizedPhoneNumber) ? '123456' : generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database first
    const { data: otpRecord, error: dbError } = await supabase
      .from('otp_verifications')
      .insert({
        phone_number: normalizedPhoneNumber,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        is_verified: false
      })
      .select()
      .single();

    if (dbError) {
      logger.error('Error storing OTP:', dbError);
      throw new Error('Failed to send OTP');
    }

    // Format phone number for Interakt
    const { countryCode, phoneNumber: number } = formatPhoneNumber(phoneNumber);

    // Prepare Interakt WhatsApp API payload
    // Using Template type with "auth" template for OTP delivery
    const payload = {
      countryCode,
      phoneNumber: number,
      callbackData: `OTP for ${phoneNumber}`,
      type: "Template",
      template: {
        name: "auth",
        languageCode: "en",
        bodyValues: [otpCode],
        buttonValues: {
          "0": [otpCode]
        }
      }
    };

    // Send via Interakt WhatsApp API
    try {
      // Log request details (mask API key for security)
      const maskedApiKey = INTERAKT_API_KEY ? `${INTERAKT_API_KEY.substring(0, 10)}...${INTERAKT_API_KEY.substring(INTERAKT_API_KEY.length - 5)}` : 'NOT_SET';
      logger.info(`📤 Sending OTP via Interakt WhatsApp to ${phoneNumber}`);
      logger.info(`📤 Interakt API URL: ${INTERAKT_BASE_URL}/message/`);
      logger.info(`📤 API Key (masked): ${maskedApiKey}`);
      logger.info(`📤 Payload: ${JSON.stringify(payload, null, 2)}`);
      
      const response = await axios.post(
        `${INTERAKT_BASE_URL}/message/`,
        payload,
        {
          headers: {
            'Authorization': `Basic ${INTERAKT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`✅ OTP sent via Interakt WhatsApp to ${phoneNumber}. Message ID: ${response.data.id || response.data.messageId}`);
      logger.info(`✅ Interakt Response: ${JSON.stringify(response.data, null, 2)}`);
      
      return {
        success: true,
        expires_in: 600, // 10 minutes in seconds
        message_id: response.data.id || response.data.messageId,
        // Only return OTP in development mode
        ...(process.env.NODE_ENV === 'development' && { otp_code: otpCode })
      };
    } catch (interaktError) {
      // Detailed error logging
      logger.error('❌ Interakt API Error Details:');
      logger.error(`   Status: ${interaktError.response?.status || 'N/A'}`);
      logger.error(`   Status Text: ${interaktError.response?.statusText || 'N/A'}`);
      logger.error(`   Error Message: ${interaktError.message}`);
      logger.error(`   Response Data: ${JSON.stringify(interaktError.response?.data || {}, null, 2)}`);
      logger.error(`   Request URL: ${interaktError.config?.url || 'N/A'}`);
      logger.error(`   Request Method: ${interaktError.config?.method || 'N/A'}`);
      logger.error(`   Request Headers: ${JSON.stringify(interaktError.config?.headers || {}, null, 2)}`);
      
      // Check if API key is set
      if (!INTERAKT_API_KEY) {
        logger.error('❌ ROOT CAUSE: INTERAKT_API_KEY is not set in environment variables');
        throw new Error('Interakt API key not configured. Please set INTERAKT_API_KEY in .env file.');
      }
      
      // Check if API key looks valid
      if (INTERAKT_API_KEY.length < 10) {
        logger.error('❌ ROOT CAUSE: INTERAKT_API_KEY appears to be invalid (too short)');
        throw new Error('Interakt API key appears to be invalid. Please check your INTERAKT_API_KEY in .env file.');
      }
      
      // Handle rate limiting
      if (interaktError.response?.status === 429) {
        logger.error('❌ ROOT CAUSE: Rate limit exceeded');
        throw new Error('Rate limit exceeded. Please retry after some time.');
      }
      
      // Handle authentication errors
      if (interaktError.response?.status === 401 || interaktError.response?.status === 403) {
        logger.error('❌ ROOT CAUSE: Invalid API key or authentication failed');
        logger.error(`   Error from Interakt: ${JSON.stringify(interaktError.response?.data || {})}`);
        throw new Error('Invalid Interakt API key. Please verify your INTERAKT_API_KEY in .env file.');
      }
      
      // Handle other API errors (400, 404, etc.)
      if (interaktError.response?.status >= 400 && interaktError.response?.status < 500) {
        const errorData = interaktError.response?.data || {};
        const errorMessage = errorData.message || errorData.error || 'Unknown error';
        logger.error('❌ ROOT CAUSE: Client error from Interakt API');
        logger.error(`   Status: ${interaktError.response?.status}`);
        logger.error(`   Error Message: ${errorMessage}`);
        logger.error(`   Full Response: ${JSON.stringify(errorData, null, 2)}`);
        
        // In development mode, if WhatsApp channel fails, return OTP anyway for testing
        const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
        if (isDevelopment && typeof errorMessage === 'string' && 
            (errorMessage.includes('Channel not connected') || 
             errorMessage.includes('WhatsApp') || 
             errorMessage.includes('not configured') ||
             errorMessage.includes('Customer is not available') ||
             errorMessage.includes('not available for the organization'))) {
          logger.warn('⚠️  WhatsApp channel issue, but returning OTP in development mode for testing');
          logger.warn(`⚠️  OTP Code: ${otpCode} (Use this for testing)`);
          logger.warn('⚠️  IMPORTANT: To receive OTP via WhatsApp, you need to:');
          logger.warn('   1. Create an OTP template named "auth" in Facebook Business Manager');
          logger.warn('   2. Sync the template in Interakt Dashboard > Templates');
          logger.warn('   3. Ensure template has body variable and button variable for OTP');
          logger.warn('   OR: Add the contact in Interakt Dashboard > Contacts first');
          logger.warn('   See: https://www.interakt.shop/resource-center/send-whatsapp-authentication-template/');
          
          // Return OTP in development mode even if WhatsApp fails
          return {
            success: true,
            expires_in: 600, // 10 minutes in seconds
            message_id: null,
            otp_code: otpCode, // Always return OTP in dev mode when WhatsApp fails
            warning: 'WhatsApp channel issue. OTP returned for testing purposes only.'
          };
        }
        
        // Provide helpful error messages based on common issues
        if (typeof errorMessage === 'string' && errorMessage.includes('Customer is not available')) {
          throw new Error('Customer phone number is not available in Interakt. Please add the contact in Interakt dashboard or ensure the customer has opted in to receive messages.');
        } else if (typeof errorMessage === 'string' && (errorMessage.includes('Channel not connected') || errorMessage.includes('WhatsApp') || errorMessage.includes('not configured'))) {
          throw new Error('WhatsApp channel is not connected in your Interakt account. Please enable WhatsApp in your Interakt dashboard settings (Settings > Configure Channels > WhatsApp).');
        } else if (typeof errorMessage === 'string' && (errorMessage.includes('cardMedia') || errorMessage.includes('suggestions') || errorMessage.includes('plainText'))) {
          throw new Error(`Interakt API validation error: ${errorMessage}. Please check the payload format.`);
        } else {
          throw new Error(`Interakt API error: ${errorMessage}`);
        }
      }
      
      // Even if Interakt fails, OTP is stored in database
      logger.warn(`⚠️  Interakt failed but OTP stored: ${otpCode}`);
      logger.warn(`⚠️  User can still verify OTP if they receive it through other means`);
      
      throw new Error('Failed to send OTP via Interakt. Please try again.');
    }
  } catch (error) {
    logger.error('Send OTP error:', error);
    throw error;
  }
}

/**
 * Verify OTP
 * @param {string} phoneNumber - Full phone number with country code
 * @param {string} otpCode - 6-digit OTP code to verify
 * @returns {Promise<Object>} Verification result
 */
async function verifyOTP(phoneNumber, otpCode) {
  try {
    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otpCode)) {
      throw new Error('OTP must be 6 digits');
    }

    // Normalize phone number for test check
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    
    // Test bypass: If test phone number with test OTP, bypass database check
    if (isTestPhoneNumber(normalizedPhoneNumber) && otpCode === '123456') {
      logger.info(`✅ Test OTP bypass: ${normalizedPhoneNumber} with OTP 123456`);
      
      // Still mark any existing OTP records as verified for consistency
      await supabase
        .from('otp_verifications')
        .update({ is_verified: true })
        .eq('phone_number', normalizedPhoneNumber)
        .eq('otp_code', '123456')
        .eq('is_verified', false);
      
      return {
        success: true,
        verified: true
      };
    }

    // Normal OTP verification flow for all other phone numbers
    const { data: otpRecord, error: findError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone_number', normalizedPhoneNumber)
      .eq('otp_code', otpCode)
      .eq('is_verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (findError || !otpRecord) {
      throw new Error('Invalid or expired OTP');
    }

    // Mark OTP as verified
    await supabase
      .from('otp_verifications')
      .update({ is_verified: true })
      .eq('id', otpRecord.id);

    return {
      success: true,
      verified: true
    };
  } catch (error) {
    logger.error('Verify OTP error:', error);
    throw error;
  }
}

/**
 * Clean up expired OTPs (run periodically)
 */
async function cleanupExpiredOTPs() {
  try {
    const { error } = await supabase
      .from('otp_verifications')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      logger.error('Cleanup OTP error:', error);
    }
  } catch (error) {
    logger.error('Cleanup OTP error:', error);
  }
}

module.exports = {
  sendOTP,
  verifyOTP,
  generateOTP,
  cleanupExpiredOTPs
};

