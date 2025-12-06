-- ============================================
-- Marketing & Promotions Database Migration
-- Comprehensive Marketing System for Minuteserv
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ENHANCED PROMO CODES TABLE
-- ============================================
-- Add missing columns to existing promo_codes table
DO $$ 
BEGIN
  -- Add max_discount if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'max_discount'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN max_discount DECIMAL(10, 2);
  END IF;

  -- Add description if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'description'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN description TEXT;
  END IF;

  -- Add promo_type if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'promo_type'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN promo_type VARCHAR(50) DEFAULT 'general';
    -- Values: 'general', 'first_time', 'new_user', 'loyalty', 'referral', 'seasonal'
  END IF;

  -- Add first_time_only if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'first_time_only'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN first_time_only BOOLEAN DEFAULT false;
  END IF;

  -- Add applicable_services if not exists (JSONB array of service IDs)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'applicable_services'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN applicable_services JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add applicable_categories if not exists (JSONB array of categories)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'applicable_categories'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN applicable_categories JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add usage_limit_per_user if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'usage_limit_per_user'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN usage_limit_per_user INTEGER DEFAULT 1;
  END IF;

  -- Add total_usage_limit if not exists (rename from usage_limit if needed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'total_usage_limit'
  ) THEN
    -- Check if usage_limit exists and copy data
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'promo_codes' AND column_name = 'usage_limit'
    ) THEN
      ALTER TABLE promo_codes ADD COLUMN total_usage_limit INTEGER;
      UPDATE promo_codes SET total_usage_limit = usage_limit WHERE usage_limit IS NOT NULL;
    ELSE
      ALTER TABLE promo_codes ADD COLUMN total_usage_limit INTEGER;
    END IF;
  END IF;

  -- Add created_by if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN created_by UUID REFERENCES admin_users(id);
  END IF;

  -- Add metadata JSONB for additional data
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promo_codes' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index for promo_type
CREATE INDEX IF NOT EXISTS idx_promo_codes_type ON promo_codes(promo_type, is_active);
CREATE INDEX IF NOT EXISTS idx_promo_codes_validity ON promo_codes(valid_from, valid_until) WHERE is_active = true;

-- ============================================
-- 2. PROMO CODE USAGE TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  order_amount DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_usage_code ON promo_code_usage(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_user ON promo_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_booking ON promo_code_usage(booking_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_user_code ON promo_code_usage(user_id, promo_code_id);

-- ============================================
-- 3. MARKETING CAMPAIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(50) NOT NULL,
  -- Values: 'promo', 'push_notification', 'sms', 'email', 'banner', 'referral'
  status VARCHAR(50) DEFAULT 'draft',
  -- Values: 'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'
  target_audience JSONB DEFAULT '{}'::jsonb,
  -- { user_segments: [], user_ids: [], filters: {} }
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  budget DECIMAL(10, 2),
  spent DECIMAL(10, 2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_type ON marketing_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON marketing_campaigns(start_date, end_date);

-- ============================================
-- 4. BANNERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500) NOT NULL,
  link_url VARCHAR(500),
  link_type VARCHAR(50),
  -- Values: 'service', 'category', 'promo_code', 'external_url', 'none'
  link_target_id UUID,
  -- Service ID, Category name, Promo code ID, or external URL
  position VARCHAR(50) DEFAULT 'top',
  -- Values: 'top', 'middle', 'bottom', 'home_carousel'
  priority INTEGER DEFAULT 0,
  -- Higher number = higher priority
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  click_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active, position) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_banners_validity ON banners(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_banners_priority ON banners(priority DESC, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_banners_campaign ON banners(campaign_id);

-- ============================================
-- 5. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  -- Values: 'push', 'sms', 'email', 'in_app'
  status VARCHAR(50) DEFAULT 'draft',
  -- Values: 'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'
  target_audience JSONB DEFAULT '{}'::jsonb,
  -- { user_segments: [], user_ids: [], filters: {} }
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  total_recipients INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  action_url VARCHAR(500),
  action_text VARCHAR(100),
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_at) WHERE status IN ('scheduled', 'sending');
CREATE INDEX IF NOT EXISTS idx_notifications_campaign ON notifications(campaign_id);

-- ============================================
-- 6. NOTIFICATION RECIPIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  phone_number VARCHAR(15),
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  -- Values: 'pending', 'sent', 'delivered', 'failed', 'opened', 'clicked'
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipients_notif ON notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_user ON notification_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_status ON notification_recipients(status);

-- ============================================
-- 7. REFERRAL PROGRAM TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  referrer_phone VARCHAR(15) NOT NULL,
  referred_phone VARCHAR(15),
  status VARCHAR(50) DEFAULT 'pending',
  -- Values: 'pending', 'completed', 'rewarded', 'expired', 'cancelled'
  referrer_reward_points INTEGER DEFAULT 0,
  referred_reward_points INTEGER DEFAULT 0,
  referrer_reward_status VARCHAR(50) DEFAULT 'pending',
  -- Values: 'pending', 'awarded', 'redeemed'
  referred_reward_status VARCHAR(50) DEFAULT 'pending',
  first_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- ============================================
-- 8. USER SEGMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  segment_type VARCHAR(50) NOT NULL,
  -- Values: 'static', 'dynamic'
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { min_bookings: 0, min_spend: 0, tier: [], city: [], etc. }
  user_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segments_type ON user_segments(segment_type);
CREATE INDEX IF NOT EXISTS idx_segments_active ON user_segments(is_active) WHERE is_active = true;

-- ============================================
-- 9. SEGMENT USERS TABLE (for static segments)
-- ============================================
CREATE TABLE IF NOT EXISTS segment_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES user_segments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(segment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_users_segment ON segment_users(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_users_user ON segment_users(user_id);

-- ============================================
-- 10. CAMPAIGN ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  cost DECIMAL(10, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign ON campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_date ON campaign_analytics(date DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update promo code used_count
CREATE OR REPLACE FUNCTION update_promo_used_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE promo_codes
  SET used_count = used_count + 1
  WHERE id = NEW.promo_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for promo code usage tracking
DROP TRIGGER IF EXISTS trigger_update_promo_count ON promo_code_usage;
CREATE TRIGGER trigger_update_promo_count
  AFTER INSERT ON promo_code_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_promo_used_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at
  BEFORE UPDATE ON user_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate referral code
CREATE OR REPLACE FUNCTION generate_referral_code(user_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  code VARCHAR(50);
  exists_check INTEGER;
BEGIN
  LOOP
    -- Generate code: MIN + last 6 chars of UUID + random 3 digits
    code := 'MIN' || UPPER(SUBSTRING(user_id::TEXT FROM 28)) || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
    
    -- Check if code exists
    SELECT COUNT(*) INTO exists_check FROM referrals WHERE referral_code = code;
    
    EXIT WHEN exists_check = 0;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED DATA: Default Referral Settings
-- ============================================
-- Note: Referral rewards configuration should be in settings table or config
-- For now, we'll create sample referral records as needed

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Marketing & Promotions database migration completed!';
  RAISE NOTICE '✅ Enhanced promo_codes table with new columns';
  RAISE NOTICE '✅ Created promo_code_usage tracking table';
  RAISE NOTICE '✅ Created marketing_campaigns table';
  RAISE NOTICE '✅ Created banners table';
  RAISE NOTICE '✅ Created notifications table';
  RAISE NOTICE '✅ Created notification_recipients table';
  RAISE NOTICE '✅ Created referrals table';
  RAISE NOTICE '✅ Created user_segments table';
  RAISE NOTICE '✅ Created segment_users table';
  RAISE NOTICE '✅ Created campaign_analytics table';
  RAISE NOTICE '✅ Created all indexes and triggers';
END $$;

