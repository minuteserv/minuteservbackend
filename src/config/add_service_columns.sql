-- ============================================
-- ADD BRAND AND ABOUT COLUMNS TO SERVICES TABLE
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add brand column
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS brand VARCHAR(255);

-- Add about column (description/description text)
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS about TEXT;

-- Add index on brand for faster searches
CREATE INDEX IF NOT EXISTS idx_services_brand ON services(brand) WHERE brand IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN services.brand IS 'Brand name associated with the service';
COMMENT ON COLUMN services.about IS 'Description or details about the service';

