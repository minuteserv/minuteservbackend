const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const twilio = require('twilio');

/**
 * OTP Service
 * Handles OTP generation, storage, and verification with Twilio SMS
 */

// Initialize Twilio client
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
} else {
  logger.warn('⚠️  Twilio credentials not configured. OTP SMS will not be sent.');
}

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP to phone number via Twilio SMS
 */
async function sendOTP(phoneNumber) {
  try {
    // Check rate limit (3 per hour per phone)
    // In development, allow more OTPs for testing
    const maxOTPsPerHour = process.env.NODE_ENV === 'development' ? 10 : 3;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const { data: recentOTPs } = await supabase
      .from('otp_verifications')
      .select('id')
      .eq('phone_number', phoneNumber)
      .gte('created_at', oneHourAgo.toISOString());

    if (recentOTPs && recentOTPs.length >= maxOTPsPerHour) {
      throw new Error(`OTP limit exceeded. Please try again after 1 hour. (${recentOTPs.length}/${maxOTPsPerHour} used)`);
    }

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database first
    const { data, error } = await supabase
      .from('otp_verifications')
      .insert({
        phone_number: phoneNumber,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        is_verified: false
      })
      .select()
      .single();

    if (error) {
      logger.error('Error storing OTP:', error);
      throw new Error('Failed to send OTP');
    }

    // Send OTP via Twilio SMS
    if (twilioClient) {
      try {
        // Format phone number for Twilio (ensure +91 format for India)
        let formattedPhone = phoneNumber;
        if (!formattedPhone.startsWith('+')) {
          // If no +, assume Indian number and add +91
          if (formattedPhone.startsWith('91')) {
            formattedPhone = '+' + formattedPhone;
          } else if (formattedPhone.startsWith('0')) {
            formattedPhone = '+91' + formattedPhone.substring(1);
          } else {
            formattedPhone = '+91' + formattedPhone;
          }
        }

        // Get Twilio phone number from env
        // For trial mode: Get number from Twilio Console → Phone Numbers → Manage → Active Numbers
        // Or verify recipient numbers at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
        let twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!twilioPhoneNumber) {
          // Try to get the first available number from Twilio account
          try {
            const incomingNumbers = await twilioClient.incomingPhoneNumbers.list({ limit: 1 });
            if (incomingNumbers && incomingNumbers.length > 0) {
              twilioPhoneNumber = incomingNumbers[0].phoneNumber;
              logger.info(`Using auto-detected Twilio number: ${twilioPhoneNumber}`);
            } else {
              throw new Error('No Twilio phone number found. Please set TWILIO_PHONE_NUMBER in .env or get a number from Twilio Console.');
            }
          } catch (numberError) {
            logger.error('Error getting Twilio phone number:', numberError);
            throw new Error('Twilio phone number not configured. Please set TWILIO_PHONE_NUMBER in .env or get a number from Twilio Console.');
          }
        }

        // Send SMS via Twilio
        const message = await twilioClient.messages.create({
          body: `Your Minuteserv OTP is ${otpCode}. Valid for 10 minutes. Do not share this code with anyone.`,
          from: twilioPhoneNumber,
          to: formattedPhone
        });

            logger.info(`✅ OTP SMS sent via Twilio to ${formattedPhone}. Message SID: ${message.sid}`);
            // OTP is sent via SMS - no need to log in production

        return {
          success: true,
          expires_in: 600, // 10 minutes in seconds
          message_sid: message.sid
        };
      } catch (twilioError) {
        logger.error('Twilio SMS error:', twilioError);
        
        // Format phone number for error message (if not already formatted)
        let errorPhoneDisplay = phoneNumber;
        if (!errorPhoneDisplay.startsWith('+')) {
          if (errorPhoneDisplay.startsWith('91')) {
            errorPhoneDisplay = '+' + errorPhoneDisplay;
          } else if (errorPhoneDisplay.startsWith('0')) {
            errorPhoneDisplay = '+91' + errorPhoneDisplay.substring(1);
          } else {
            errorPhoneDisplay = '+91' + errorPhoneDisplay;
          }
        }
        
        // Check if it's a verification error (trial mode)
        if (twilioError.code === 21211 || twilioError.message?.includes('unverified')) {
          logger.error(`Phone number ${errorPhoneDisplay} is not verified in Twilio trial mode.`);
          logger.error(`Please verify at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified`);
          throw new Error(`Phone number not verified. Please verify ${errorPhoneDisplay} in Twilio Console for trial mode.`);
        }
        
        // Other Twilio errors - don't fail completely, OTP is stored
        logger.warn(`OTP stored but SMS failed for ${phoneNumber}: ${otpCode}`);
        logger.warn(`Twilio error: ${twilioError.message}`);
        
          // Return success but log the error
          return {
            success: true,
            expires_in: 600,
            warning: 'SMS delivery may have failed, but OTP is stored'
          };
      }
    } else {
      // Twilio not configured - OTP is stored in database
      logger.warn(`⚠️  Twilio not configured. OTP stored but SMS not sent. OTP: ${otpCode}`);
      
      return {
        success: true,
        expires_in: 600,
        warning: 'SMS not configured. Please check backend logs for OTP.'
      };
    }
  } catch (error) {
    logger.error('Send OTP error:', error);
    throw error;
  }
}

/**
 * Verify OTP
 */
async function verifyOTP(phoneNumber, otpCode) {
  try {
    // Find valid OTP
    const { data: otpRecord, error: findError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone_number', phoneNumber)
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

