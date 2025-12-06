-- ============================================
-- Business Documents Database Migration
-- Comprehensive Document Management System for Minuteserv Admin Panel
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- BUSINESS_DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS business_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL, -- 'financial', 'legal', 'operational', 'marketing', 'reports', 'miscellaneous'
    document_category VARCHAR(100), -- Subcategory like 'invoice', 'contract', 'license', etc.
    file_url TEXT NOT NULL, -- Supabase Storage URL
    file_path TEXT NOT NULL, -- Storage path in Supabase bucket
    file_size BIGINT, -- File size in bytes
    mime_type VARCHAR(100), -- 'application/pdf', 'image/png', etc.
    description TEXT,
    tags TEXT[], -- Array of tags for better organization
    related_entity_type VARCHAR(50), -- 'booking', 'partner', 'customer', 'service', 'payment', null
    related_entity_id UUID, -- ID of related entity
    expiry_date DATE, -- For documents with expiry (licenses, certificates)
    is_archived BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1, -- For document revisions
    uploaded_by UUID REFERENCES admin_users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for business_documents
CREATE INDEX IF NOT EXISTS idx_business_documents_type ON business_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_business_documents_category ON business_documents(document_category);
CREATE INDEX IF NOT EXISTS idx_business_documents_uploaded_at ON business_documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_documents_uploaded_by ON business_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_business_documents_is_archived ON business_documents(is_archived);
CREATE INDEX IF NOT EXISTS idx_business_documents_related_entity ON business_documents(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_business_documents_tags ON business_documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_business_documents_expiry_date ON business_documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_business_documents_updated_at
    BEFORE UPDATE ON business_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_business_documents_updated_at();

-- Comments for documentation
COMMENT ON TABLE business_documents IS 'Stores all business documents uploaded through admin panel';
COMMENT ON COLUMN business_documents.document_type IS 'Main category: financial, legal, operational, marketing, reports, miscellaneous';
COMMENT ON COLUMN business_documents.document_category IS 'Subcategory for better organization';
COMMENT ON COLUMN business_documents.file_url IS 'Public URL to access the document from Supabase Storage';
COMMENT ON COLUMN business_documents.file_path IS 'Storage path in Supabase bucket (business-documents/)';
COMMENT ON COLUMN business_documents.tags IS 'Array of tags for flexible searching and filtering';
COMMENT ON COLUMN business_documents.related_entity_type IS 'Type of related entity (booking, partner, customer, service, payment)';
COMMENT ON COLUMN business_documents.related_entity_id IS 'UUID of the related entity';
COMMENT ON COLUMN business_documents.expiry_date IS 'Expiry date for time-sensitive documents like licenses';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Create Supabase Storage bucket named 'business-documents'
-- 2. Set bucket to public or configure RLS policies
-- 3. Test document upload functionality

