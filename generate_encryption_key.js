#!/usr/bin/env node

/**
 * Generate Encryption Key Script
 * Generates a secure 32-byte encryption key for credentials management
 * 
 * Usage:
 *   node generate_encryption_key.js
 */

const crypto = require('crypto');

console.log('🔐 Generating CREDENTIALS_ENCRYPTION_KEY...\n');

// Generate a 32-byte random key and convert to hex (64 characters)
const key = crypto.randomBytes(32).toString('hex');

console.log('Generated Key:');
console.log(key);
console.log('\n✅ Add this to your .env file:');
console.log(`CREDENTIALS_ENCRYPTION_KEY=${key}\n`);
console.log('⚠️  IMPORTANT:');
console.log('  - Keep this key secure!');
console.log('  - Never commit it to version control');
console.log('  - If lost, encrypted credentials cannot be recovered');
console.log('  - Use different keys for development and production\n');

