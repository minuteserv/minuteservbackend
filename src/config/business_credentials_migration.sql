-- ============================================
-- Business Credentials Database Migration
-- Comprehensive Credentials Management System for Minuteserv Admin Panel
-- Stores encrypted business-related credentials (GitHub, Hostinger, etc.)
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- BUSINESS_CREDENTIALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS business_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_name VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL, -- 'github', 'hostinger', 'aws', 'google_cloud', 'digitalocean', 'vercel', 'netlify', 'domain_registrar', 'email_service', 'payment_gateway', 'api_service', 'other'
    service_category VARCHAR(100), -- Subcategory like 'hosting', 'version_control', 'cloud', 'domain', etc.
    
    -- Credential fields
    username VARCHAR(255), -- User ID, Email, Phone, or Username
    email VARCHAR(255), -- Email if different from username
    phone VARCHAR(50), -- Phone number if applicable
    password_encrypted TEXT NOT NULL, -- Encrypted password using pgcrypto
    api_key TEXT, -- API key if applicable (encrypted)
    api_secret TEXT, -- API secret if applicable (encrypted)
    access_token TEXT, -- OAuth access token if applicable (encrypted)
    refresh_token TEXT, -- OAuth refresh token if applicable (encrypted)
    
    -- Additional metadata
    url VARCHAR(500), -- Service URL (e.g., https://github.com/username, https://hostinger.com)
    account_id VARCHAR(255), -- Account ID or customer ID
    notes TEXT, -- Additional notes or instructions
    tags TEXT[], -- Array of tags for better organization
    
    -- Security & Access
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE, -- Track last usage
    expires_at TIMESTAMP WITH TIME ZONE, -- For tokens that expire
    
    -- Versioning & Audit
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES admin_users(id),
    updated_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for business_credentials
CREATE INDEX IF NOT EXISTS idx_business_credentials_service_type ON business_credentials(service_type);
CREATE INDEX IF NOT EXISTS idx_business_credentials_service_category ON business_credentials(service_category);
CREATE INDEX IF NOT EXISTS idx_business_credentials_created_at ON business_credentials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_credentials_created_by ON business_credentials(created_by);
CREATE INDEX IF NOT EXISTS idx_business_credentials_is_active ON business_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_business_credentials_tags ON business_credentials USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_business_credentials_expires_at ON business_credentials(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_credentials_credential_name ON business_credentials(credential_name);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_business_credentials_updated_at
    BEFORE UPDATE ON business_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_business_credentials_updated_at();

-- Function to encrypt password (wrapper for pgcrypto encrypt)
-- Note: Encryption key should be stored in environment variable
-- This function uses a secret key that should be set via application logic
CREATE OR REPLACE FUNCTION encrypt_credential(plaintext TEXT, secret_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(plaintext || secret_key, 'sha256'), 'hex');
    -- Note: For production, consider using pgcrypto's encrypt() function with proper key management
    -- For now, using SHA256 hash - application layer should handle actual encryption
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE business_credentials IS 'Stores all business-related credentials (passwords, API keys, tokens) with encryption';
COMMENT ON COLUMN business_credentials.service_type IS 'Main service type: github, hostinger, aws, google_cloud, digitalocean, vercel, netlify, domain_registrar, email_service, payment_gateway, api_service, other';
COMMENT ON COLUMN business_credentials.service_category IS 'Subcategory for better organization';
COMMENT ON COLUMN business_credentials.username IS 'User ID, Email, Phone, or Username depending on service';
COMMENT ON COLUMN business_credentials.password_encrypted IS 'Encrypted password - decryption happens at application layer';
COMMENT ON COLUMN business_credentials.api_key IS 'API key if applicable (encrypted)';
COMMENT ON COLUMN business_credentials.api_secret IS 'API secret if applicable (encrypted)';
COMMENT ON COLUMN business_credentials.tags IS 'Array of tags for flexible searching and filtering';
COMMENT ON COLUMN business_credentials.expires_at IS 'Expiry date for tokens or credentials that expire';

-- ============================================
-- CREDENTIAL_ACCESS_LOGS TABLE (Optional - for audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS credential_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_id UUID REFERENCES business_credentials(id) ON DELETE CASCADE,
    accessed_by UUID REFERENCES admin_users(id),
    access_type VARCHAR(50) NOT NULL, -- 'view', 'decrypt', 'update', 'delete'
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for access logs
CREATE INDEX IF NOT EXISTS idx_credential_access_logs_credential_id ON credential_access_logs(credential_id);
CREATE INDEX IF NOT EXISTS idx_credential_access_logs_accessed_by ON credential_access_logs(accessed_by);
CREATE INDEX IF NOT EXISTS idx_credential_access_logs_accessed_at ON credential_access_logs(accessed_at DESC);

COMMENT ON TABLE credential_access_logs IS 'Audit trail for credential access (viewing, decrypting, updating)';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Set encryption key in environment variable (CREDENTIALS_ENCRYPTION_KEY)
-- 2. Implement encryption/decryption in application layer
-- 3. Test credential storage and retrieval
-- 4. Set up proper access controls and audit logging

