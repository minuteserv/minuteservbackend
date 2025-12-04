const axios = require('axios');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || '6930040e475ae21f4f0c2ef9';
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'MSERV';
const MSG91_BASE_URL = 'https://control.msg91.com/api/v5'; // Correct endpoint: control.msg91.com (as per MSG91 docs)

/**
 * MSG91 OTP Service
 * Handles OTP generation, storage, and verification with MSG91 SMS API
 * Uses 4-digit OTP (MSG91 default)
 * Template ID: 6930040e475ae21f4f0c2ef9 (Auth template)
 */

/**
 * Generate 4-digit OTP (MSG91 default)
 */
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
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
 * Format phone number for MSG91 API (keep country code 91, remove +)
 * Input: "+919876543210"
 * Output: "919876543210" (with country code, without +)
 * MSG91 requires international format with country code
 */
function formatPhoneNumberForMSG91(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  // Remove + but keep 91 (country code)
  // MSG91 needs: 91XXXXXXXXXX format (not +91XXXXXXXXXX and not just XXXXXXXXXX)
  return normalized.replace(/^\+/, '');
}

/**
 * Check if phone number is the test number (9999999999)
 */
function isTestPhoneNumber(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  return normalized === '+919999999999';
}

/**
 * Send OTP via MSG91 SMS API
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
    
    // Generate 4-digit OTP (use test OTP for test phone number)
    const otpCode = isTestPhoneNumber(normalizedPhoneNumber) ? '1234' : generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Check for recent OTP sends (prevent duplicate sends within 10 seconds - MSG91 error 311)
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
    const { data: recentSends } = await supabase
      .from('otp_verifications')
      .select('id, created_at')
      .eq('phone_number', normalizedPhoneNumber)
      .gte('created_at', tenSecondsAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentSends && recentSends.length > 0) {
      const lastSendTime = new Date(recentSends[0].created_at);
      const secondsSinceLastSend = Math.floor((Date.now() - lastSendTime.getTime()) / 1000);
      logger.warn(`⚠️  Duplicate OTP request detected for ${normalizedPhoneNumber}`);
      logger.warn(`⚠️  Last OTP sent ${secondsSinceLastSend} seconds ago (MSG91 requires 10+ seconds)`);
      throw new Error(`Please wait at least 10 seconds before requesting another OTP. Last OTP was sent ${secondsSinceLastSend} seconds ago.`);
    }

    // Store OTP in database for logging/auditing (verification is done via MSG91)
    const { data: _otpRecord, error: dbError } = await supabase
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
      // Check if it's a duplicate key error (race condition)
      if (dbError.code === '23505') {
        logger.warn('⚠️  Duplicate OTP insert detected (race condition)');
        throw new Error('OTP request already in progress. Please wait a moment.');
      }
      throw new Error('Failed to send OTP');
    }

    // Format phone number for MSG91 (remove +91, keep only digits)
    const mobileNumber = formatPhoneNumberForMSG91(phoneNumber);

    // Check if MSG91 Auth Key is configured
    if (!MSG91_AUTH_KEY) {
      logger.error('❌ ROOT CAUSE: MSG91_AUTH_KEY is not set in environment variables');
      throw new Error('MSG91 API key not configured. Please set MSG91_AUTH_KEY in .env file.');
    }

    logger.info(`🔍 ========== MSG91 OTP SEND REQUEST ==========`);
    logger.info(`📱 Phone Number (input): ${phoneNumber}`);
    logger.info(`📱 Phone Number (normalized): ${normalizedPhoneNumber}`);
    logger.info(`📱 Phone Number (for MSG91): ${mobileNumber}`);
    logger.info(`🔑 OTP Code Generated: ${otpCode}`);
    logger.info(`🔑 Is Test Number: ${isTestPhoneNumber(normalizedPhoneNumber)}`);

    // Prepare MSG91 API URL with query parameters
    // EXACT format from working curl: https://control.msg91.com/api/v5/otp?otp_expiry=10&template_id=XXX&mobile=91XXX&authkey=XXX&realTimeResponse=1
    // NOTE: Do NOT pass otp parameter - let MSG91 generate it and use MSG91's verify endpoint
    const queryParams = new URLSearchParams({
      otp_expiry: '10', // OTP expiry in minutes
      template_id: MSG91_TEMPLATE_ID,
      mobile: mobileNumber, // Format: 91XXXXXXXXXX (with country code, without +)
      authkey: MSG91_AUTH_KEY,
      realTimeResponse: '1' // Get real-time response
    });

    // Send via MSG91 API
    try {
      const maskedAuthKey = MSG91_AUTH_KEY ? `${MSG91_AUTH_KEY.substring(0, 10)}...${MSG91_AUTH_KEY.substring(MSG91_AUTH_KEY.length - 5)}` : 'NOT_SET';
      const apiUrl = `${MSG91_BASE_URL}/otp?${queryParams.toString()}`;
      const maskedUrl = apiUrl.replace(MSG91_AUTH_KEY, maskedAuthKey);
      
      // Console logs for immediate visibility
      console.log('\n🔵 ========== MSG91 API REQUEST ==========');
      console.log(`🔵 API URL: ${maskedUrl}`);
      console.log(`🔵 Auth Key (masked): ${maskedAuthKey}`);
      console.log(`🔵 Template ID: ${MSG91_TEMPLATE_ID}`);
      console.log(`🔵 Sender ID: ${MSG91_SENDER_ID}`);
      console.log(`🔵 Phone Number: ${mobileNumber} (format: 91XXXXXXXXXX)`);
      console.log(`🔵 OTP Code: ${otpCode}`);
      console.log(`🔵 OTP Expiry: 10 minutes`);
      
      logger.info(`📤 ========== MSG91 API REQUEST ==========`);
      logger.info(`📤 API URL: ${maskedUrl}`);
      logger.info(`📤 Auth Key (masked): ${maskedAuthKey}`);
      logger.info(`📤 Template ID: ${MSG91_TEMPLATE_ID}`);
      logger.info(`📤 Sender ID: ${MSG91_SENDER_ID}`);
      logger.info(`📤 Phone Number Format: ${mobileNumber} (format: 91XXXXXXXXXX with country code)`);
      logger.info(`📤 Using query parameters as per MSG91 Postman collection`);
      
      const response = await axios.post(
        apiUrl,
        null, // No body - all params in URL query string
        {
          headers: {
            'accept': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      // Console logs for immediate visibility
      console.log('\n🟢 ========== MSG91 API RESPONSE ==========');
      console.log(`🟢 Status Code: ${response.status}`);
      console.log(`🟢 Status Text: ${response.statusText}`);
      console.log(`🟢 Full Response Data:`, JSON.stringify(response.data, null, 2));
      console.log(`🟢 Response Type:`, typeof response.data);
      
      logger.info(`✅ ========== MSG91 API RESPONSE ==========`);
      logger.info(`✅ Status Code: ${response.status}`);
      logger.info(`✅ Status Text: ${response.statusText}`);
      logger.info(`✅ Response Headers: ${JSON.stringify(response.headers, null, 2)}`);
      logger.info(`✅ Full Response Data: ${JSON.stringify(response.data, null, 2)}`);
      logger.info(`✅ Response Type: ${typeof response.data}`);
      
      // MSG91 API response format can vary - check multiple possible success indicators
      const responseData = response.data;
      const isSuccess = 
        (responseData && responseData.type === 'success') ||
        (responseData && responseData.message && responseData.message.toLowerCase().includes('success')) ||
        (response.status === 200 && responseData) ||
        (responseData && responseData.request_id);
      
      if (isSuccess) {
        logger.info(`✅ OTP successfully sent via MSG91 SMS to ${phoneNumber} (${mobileNumber})`);
        logger.info(`✅ OTP Code: ${otpCode}`);
        logger.info(`✅ Request ID: ${responseData.request_id || 'N/A'}`);
        
        return {
          success: true,
          expires_in: 600, // 10 minutes in seconds
          message_id: responseData.request_id || responseData.id || null,
          // Always return OTP in development mode for testing
          ...(process.env.NODE_ENV === 'development' && { otp_code: otpCode })
        };
      } else {
        logger.warn(`⚠️  MSG91 API returned non-success response`);
        logger.warn(`⚠️  Response: ${JSON.stringify(responseData, null, 2)}`);
        throw new Error(responseData.message || responseData.error || 'Failed to send OTP via MSG91');
      }
    } catch (msg91Error) {
      // Console logs for immediate visibility
      console.log('\n🔴 ========== MSG91 API ERROR ==========');
      console.log(`🔴 Error Type: ${msg91Error.name || 'Unknown'}`);
      console.log(`🔴 Error Message: ${msg91Error.message}`);
      console.log(`🔴 Status Code: ${msg91Error.response?.status || 'N/A'}`);
      console.log(`🔴 Status Text: ${msg91Error.response?.statusText || 'N/A'}`);
      console.log(`🔴 Response Data:`, JSON.stringify(msg91Error.response?.data || {}, null, 2));
      if (msg91Error.response?.data) {
        console.log(`🔴 Error Code: ${msg91Error.response.data.code || msg91Error.response.data.error_code || 'N/A'}`);
        console.log(`🔴 Error Message: ${msg91Error.response.data.message || msg91Error.response.data.error || 'N/A'}`);
      }
      
      // Detailed error logging
      logger.error(`❌ ========== MSG91 API ERROR ==========`);
      logger.error(`❌ Error Type: ${msg91Error.name || 'Unknown'}`);
      logger.error(`❌ Error Message: ${msg91Error.message}`);
      logger.error(`❌ Status Code: ${msg91Error.response?.status || 'N/A'}`);
      logger.error(`❌ Status Text: ${msg91Error.response?.statusText || 'N/A'}`);
      logger.error(`❌ Request URL: ${msg91Error.config?.url || 'N/A'}`);
      logger.error(`❌ Request Method: ${msg91Error.config?.method || 'N/A'}`);
      logger.error(`❌ Request Payload: ${JSON.stringify(msg91Error.config?.data ? JSON.parse(msg91Error.config.data) : {}, null, 2)}`);
      logger.error(`❌ Response Headers: ${JSON.stringify(msg91Error.response?.headers || {}, null, 2)}`);
      logger.error(`❌ Response Data: ${JSON.stringify(msg91Error.response?.data || {}, null, 2)}`);
      logger.error(`❌ Full Error Stack: ${msg91Error.stack || 'N/A'}`);
      
      // Check if API key is set
      if (!MSG91_AUTH_KEY) {
        logger.error('❌ ROOT CAUSE: MSG91_AUTH_KEY is not set in environment variables');
        throw new Error('MSG91 API key not configured. Please set MSG91_AUTH_KEY in .env file.');
      }
      
      // Handle authentication errors
      if (msg91Error.response?.status === 401 || msg91Error.response?.status === 403) {
        logger.error('❌ ROOT CAUSE: Invalid Auth Key or authentication failed');
        logger.error(`   Error from MSG91: ${JSON.stringify(msg91Error.response?.data || {})}`);
        throw new Error('Invalid MSG91 Auth Key. Please verify your MSG91_AUTH_KEY in .env file.');
      }
      
      // Handle rate limiting
      if (msg91Error.response?.status === 429) {
        logger.error('❌ ROOT CAUSE: Rate limit exceeded');
        throw new Error('Rate limit exceeded. Please retry after some time.');
      }
      
      // Handle other API errors
      if (msg91Error.response?.status >= 400 && msg91Error.response?.status < 500) {
        const errorData = msg91Error.response?.data || {};
        const errorMessage = errorData.message || errorData.error || 'Unknown error';
        const errorCode = errorData.code || errorData.error_code || msg91Error.response?.status;
        
        logger.error('❌ ROOT CAUSE: Client error from MSG91 API');
        logger.error(`   Status: ${msg91Error.response?.status}`);
        logger.error(`   Error Code: ${errorCode}`);
        logger.error(`   Error Message: ${errorMessage}`);
        logger.error(`   Full Response: ${JSON.stringify(errorData, null, 2)}`);
        
        // Handle specific MSG91 error codes
        if (errorCode === 311 || errorMessage.includes('311') || errorMessage.toLowerCase().includes('duplicate')) {
          logger.error('❌ MSG91 Error 311: Duplicate SMS sent within 10 seconds');
          logger.error('❌ Solution: Wait at least 10 seconds between OTP requests to the same number');
          throw new Error('Duplicate OTP request detected. Please wait at least 10 seconds before requesting another OTP.');
        }
        
        // In development mode, if MSG91 fails, return OTP anyway for testing
        const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
        if (isDevelopment && errorCode !== 311) {
          logger.warn('⚠️  MSG91 API issue, but returning OTP in development mode for testing');
          logger.warn(`⚠️  OTP Code: ${otpCode} (Use this for testing)`);
          logger.warn('⚠️  IMPORTANT: To receive OTP via SMS, ensure MSG91_AUTH_KEY is correctly set');
          
          // Return OTP in development mode even if MSG91 fails (except for error 311)
          return {
            success: true,
            expires_in: 600, // 10 minutes in seconds
            message_id: null,
            otp_code: otpCode, // Always return OTP in dev mode when MSG91 fails
            warning: `MSG91 API error (${errorCode}). OTP returned for testing purposes only.`
          };
        }
        
        throw new Error(`MSG91 API error (${errorCode}): ${errorMessage}`);
      }
      
      // Even if MSG91 fails, OTP is stored in database
      logger.warn(`⚠️  MSG91 failed but OTP stored: ${otpCode}`);
      logger.warn(`⚠️  User can still verify OTP if they receive it through other means`);
      
      throw new Error('Failed to send OTP via MSG91. Please try again.');
    }
  } catch (error) {
    logger.error('Send OTP error:', error);
    throw error;
  }
}

/**
 * Verify OTP using MSG91's verify endpoint
 * @param {string} phoneNumber - Full phone number with country code
 * @param {string} otpCode - 4-digit OTP code to verify
 * @returns {Promise<Object>} Verification result
 */
async function verifyOTP(phoneNumber, otpCode) {
  try {
    // Validate OTP format (4 digits)
    if (!/^\d{4}$/.test(otpCode)) {
      throw new Error('OTP must be 4 digits');
    }

    // Normalize phone number for test check
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const mobileNumber = formatPhoneNumberForMSG91(normalizedPhoneNumber);
    
    // Test bypass: If test phone number with test OTP, bypass MSG91 verification
    if (isTestPhoneNumber(normalizedPhoneNumber) && otpCode === '1234') {
      logger.info(`✅ Test OTP bypass: ${normalizedPhoneNumber} with OTP 1234`);
      return {
        success: true,
        verified: true
      };
    }

    // Use MSG91's verify endpoint - EXACT format from MSG91 docs:
    // GET https://control.msg91.com/api/v5/otp/verify?otp=12345&mobile=91XXXXXXX&authkey=XXXXX
    const queryParams = new URLSearchParams({
      otp: otpCode,
      mobile: mobileNumber,
      authkey: MSG91_AUTH_KEY
    });
    const verifyUrl = `${MSG91_BASE_URL}/otp/verify?${queryParams.toString()}`;
    
    const maskedAuthKey = MSG91_AUTH_KEY ? `${MSG91_AUTH_KEY.substring(0, 10)}...` : 'NOT_SET';
    const maskedUrl = verifyUrl.replace(MSG91_AUTH_KEY, maskedAuthKey);
    
    console.log('\n🔵 ========== MSG91 VERIFY REQUEST ==========');
    console.log(`🔵 Method: GET`);
    console.log(`🔵 URL: ${maskedUrl}`);
    console.log(`🔵 Mobile: ${mobileNumber}`);
    console.log(`🔵 OTP: ${otpCode}`);
    
    logger.info(`📤 MSG91 Verify Request - Method: GET`);
    logger.info(`📤 MSG91 Verify URL: ${maskedUrl}`);
    logger.info(`📤 MSG91 Verify - Mobile: ${mobileNumber}, OTP: ${otpCode}`);
    
    const response = await axios({
      method: 'GET',
      url: verifyUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('\n🟢 ========== MSG91 VERIFY RESPONSE ==========');
    console.log(`🟢 Status: ${response.status}`);
    console.log(`🟢 Data:`, JSON.stringify(response.data, null, 2));
    
    logger.info(`✅ MSG91 Verify Response: ${JSON.stringify(response.data)}`);
    
    // MSG91 returns { "type": "success", "message": "OTP verified successfully" } on success
    const responseData = response.data;
    const isSuccess = 
      responseData.type === 'success' ||
      responseData.message?.toLowerCase().includes('success') ||
      responseData.message?.toLowerCase().includes('verified');
    
    if (isSuccess) {
      return {
        success: true,
        verified: true
      };
    } else {
      throw new Error(responseData.message || 'OTP verification failed');
    }
  } catch (error) {
    // Handle MSG91 API errors
    if (error.response) {
      console.log('\n🔴 ========== MSG91 VERIFY ERROR ==========');
      console.log(`🔴 Status: ${error.response.status}`);
      console.log(`🔴 Data:`, JSON.stringify(error.response.data, null, 2));
      
      const errorData = error.response.data;
      const errorMessage = errorData.message || 'Invalid or expired OTP';
      throw new Error(errorMessage);
    }
    logger.error('Verify OTP error:', error);
    throw error;
  }
}

/**
 * Resend OTP using MSG91's retry endpoint
 * @param {string} phoneNumber - Full phone number with country code
 * @param {string} retryType - 'text' for SMS, 'voice' for voice call (default: 'text')
 * @returns {Promise<Object>} Resend result
 */
async function resendOTP(phoneNumber, retryType = 'text') {
  try {
    // Normalize phone number
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const mobileNumber = formatPhoneNumberForMSG91(normalizedPhoneNumber);
    
    // Test bypass: If test phone number, return success without hitting MSG91
    if (isTestPhoneNumber(normalizedPhoneNumber)) {
      logger.info(`✅ Test OTP resend bypass: ${normalizedPhoneNumber}`);
      return {
        success: true,
        message: 'OTP resent successfully (test mode)',
        type: retryType
      };
    }

    // Use MSG91's retry endpoint - EXACT format from MSG91 docs:
    // GET https://control.msg91.com/api/v5/otp/retry?authkey=XXX&retrytype=text&mobile=91XXXXXXXX
    const queryParams = new URLSearchParams({
      authkey: MSG91_AUTH_KEY,
      retrytype: retryType, // 'text' for SMS, 'voice' for voice call
      mobile: mobileNumber
    });
    const retryUrl = `${MSG91_BASE_URL}/otp/retry?${queryParams.toString()}`;
    
    const maskedAuthKey = MSG91_AUTH_KEY ? `${MSG91_AUTH_KEY.substring(0, 10)}...` : 'NOT_SET';
    const maskedUrl = retryUrl.replace(MSG91_AUTH_KEY, maskedAuthKey);
    
    console.log('\n🔵 ========== MSG91 RESEND/RETRY REQUEST ==========');
    console.log(`🔵 Method: GET`);
    console.log(`🔵 URL: ${maskedUrl}`);
    console.log(`🔵 Mobile: ${mobileNumber}`);
    console.log(`🔵 Retry Type: ${retryType}`);
    
    logger.info(`📤 MSG91 Resend Request - Method: GET`);
    logger.info(`📤 MSG91 Resend URL: ${maskedUrl}`);
    logger.info(`📤 MSG91 Resend - Mobile: ${mobileNumber}, Type: ${retryType}`);
    
    const response = await axios({
      method: 'GET',
      url: retryUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('\n🟢 ========== MSG91 RESEND RESPONSE ==========');
    console.log(`🟢 Status: ${response.status}`);
    console.log(`🟢 Data:`, JSON.stringify(response.data, null, 2));
    
    logger.info(`✅ MSG91 Resend Response: ${JSON.stringify(response.data)}`);
    
    // MSG91 returns { "type": "success", "message": "otp_sent_successfully" } on success
    const responseData = response.data;
    const isSuccess = 
      responseData.type === 'success' ||
      responseData.message?.toLowerCase().includes('success') ||
      responseData.message?.toLowerCase().includes('sent');
    
    if (isSuccess) {
      return {
        success: true,
        message: 'OTP resent successfully',
        type: retryType,
        request_id: responseData.request_id || null
      };
    } else {
      throw new Error(responseData.message || 'Failed to resend OTP');
    }
  } catch (error) {
    // Handle MSG91 API errors
    if (error.response) {
      console.log('\n🔴 ========== MSG91 RESEND ERROR ==========');
      console.log(`🔴 Status: ${error.response.status}`);
      console.log(`🔴 Data:`, JSON.stringify(error.response.data, null, 2));
      
      const errorData = error.response.data;
      const errorMessage = errorData.message || 'Failed to resend OTP';
      
      // Handle specific error: OTP not generated yet
      if (errorMessage.toLowerCase().includes('not generated') || 
          errorMessage.toLowerCase().includes('no otp')) {
        throw new Error('No OTP request found. Please request a new OTP first.');
      }
      
      throw new Error(errorMessage);
    }
    logger.error('Resend OTP error:', error);
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
  resendOTP,
  generateOTP,
  cleanupExpiredOTPs
};

