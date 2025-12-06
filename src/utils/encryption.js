/**
 * Encryption Utility for Business Credentials
 * Uses AES-256-GCM for secure encryption/decryption
 */

const crypto = require('crypto');

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for IV
const SALT_LENGTH = 64; // 64 bytes for salt
const TAG_LENGTH = 16; // 16 bytes for GCM tag
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Get encryption key from environment or use a default (for development only)
 * In production, CREDENTIALS_ENCRYPTION_KEY must be set in environment variables
 */
function getEncryptionKey() {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  
  if (!key) {
    // For development only - warn if not set
    console.warn('⚠️  WARNING: CREDENTIALS_ENCRYPTION_KEY not set in environment variables!');
    console.warn('⚠️  Using default key for development. THIS IS INSECURE FOR PRODUCTION!');
    console.warn('⚠️  Set CREDENTIALS_ENCRYPTION_KEY in your .env file (32+ character random string)');
    
    // Default key for development (32 bytes)
    return 'dev-key-not-secure-change-in-production-32bytes!!';
  }
  
  // Use the provided key (should be at least 32 bytes)
  // If it's shorter, we'll derive a key from it using PBKDF2
  if (key.length < 32) {
    console.warn('⚠️  WARNING: CREDENTIALS_ENCRYPTION_KEY is too short. Deriving key using PBKDF2.');
    return crypto.pbkdf2Sync(key, 'minuteserv-salt', 100000, KEY_LENGTH, 'sha256');
  }
  
  // If key is exactly 32 bytes, use it directly
  if (key.length === 32) {
    return Buffer.from(key, 'utf8');
  }
  
  // If key is longer, hash it to 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt text using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted string in format: salt:iv:tag:encrypted
 */
function encrypt(text) {
  try {
    if (!text || text === '') {
      return '';
    }
    
    const key = getEncryptionKey();
    
    // Generate random IV and salt
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Derive encryption key from master key and salt (optional extra layer)
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha256');
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const tag = cipher.getAuthTag();
    
    // Return format: salt:iv:tag:encrypted (all hex encoded)
    return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt text using AES-256-GCM
 * @param {string} encryptedText - Encrypted string in format: salt:iv:tag:encrypted
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedText) {
  try {
    if (!encryptedText || encryptedText === '') {
      return '';
    }
    
    // Split the encrypted string
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [saltHex, ivHex, tagHex, encrypted] = parts;
    
    // Convert hex strings to buffers
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const key = getEncryptionKey();
    
    // Derive decryption key from master key and salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha256');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data - invalid key or corrupted data');
  }
}

/**
 * Hash a password (one-way) - for comparison without storing plaintext
 * @param {string} password - Password to hash
 * @returns {string} - Hashed password
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain password
 * @param {string} hash - Stored hash
 * @returns {boolean} - True if password matches
 */
function verifyPassword(password, hash) {
  const [salt, storedHash] = hash.split(':');
  const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return computedHash === storedHash;
}

module.exports = {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
};

