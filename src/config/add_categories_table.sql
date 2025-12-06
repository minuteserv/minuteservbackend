-- ============================================
-- CATEGORIES TABLE
-- Add this to your database schema
-- ============================================
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_active ON service_categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_order ON service_categories(display_order, is_active);

-- Insert default categories
INSERT INTO service_categories (name, display_order, is_active) VALUES
  ('Clean up', 1, true),
  ('Facial', 2, true),
  ('Bleach', 3, true),
  ('Waxing', 4, true),
  ('Pedicure', 5, true),
  ('Manicure', 6, true),
  ('Head', 7, true),
  ('Hair Colour', 8, true),
  ('Makeover', 9, true),
  ('Nail Art', 10, true),
  ('Mehendi', 11, true)
ON CONFLICT (name) DO NOTHING;

-- Add trigger to update updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON service_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

