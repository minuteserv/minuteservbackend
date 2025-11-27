-- ============================================
-- Loyalty Points System - Database Migration
-- Run this script in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. USER_POINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_balance INTEGER DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_points_earned INTEGER DEFAULT 0 CHECK (lifetime_points_earned >= 0),
  lifetime_points_redeemed INTEGER DEFAULT 0 CHECK (lifetime_points_redeemed >= 0),
  current_tier VARCHAR(20) DEFAULT 'bronze' CHECK (current_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  tier_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_tier ON user_points(current_tier);

-- ============================================
-- 2. POINTS_TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted')),
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  source_type VARCHAR(50),
  source_id UUID,
  description TEXT,
  metadata JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(50) DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON points_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created_at ON points_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_transactions_source ON points_transactions(source_type, source_id);

-- ============================================
-- 3. POINTS_REDEMPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS points_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_used INTEGER NOT NULL CHECK (points_used > 0),
  discount_amount DECIMAL(10, 2) NOT NULL CHECK (discount_amount > 0),
  redemption_type VARCHAR(50) DEFAULT 'discount_voucher' CHECK (redemption_type IN ('discount_voucher', 'apply_to_booking')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'expired', 'cancelled')),
  booking_id UUID REFERENCES bookings(id),
  voucher_code VARCHAR(50) UNIQUE,
  expires_at TIMESTAMP,
  applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_points_redemptions_user_id ON points_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_redemptions_status ON points_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_points_redemptions_voucher_code ON points_redemptions(voucher_code);
CREATE INDEX IF NOT EXISTS idx_points_redemptions_booking_id ON points_redemptions(booking_id);

-- ============================================
-- 4. LOYALTY_TIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name VARCHAR(20) UNIQUE NOT NULL CHECK (tier_name IN ('bronze', 'silver', 'gold', 'platinum')),
  min_points INTEGER NOT NULL CHECK (min_points >= 0),
  max_points INTEGER,
  cashback_percentage DECIMAL(5, 2) DEFAULT 0.00 CHECK (cashback_percentage >= 0 AND cashback_percentage <= 100),
  benefits JSONB DEFAULT '[]'::jsonb,
  badge_color VARCHAR(7),
  badge_icon VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default tier data
INSERT INTO loyalty_tiers (tier_name, min_points, max_points, cashback_percentage, benefits, badge_color, badge_icon, is_active)
VALUES
  ('bronze', 0, 5000, 5.00, '["basic_rewards"]'::jsonb, '#CD7F32', 'bronze-medal', true),
  ('silver', 5000, 15000, 10.00, '["priority_booking", "birthday_bonus"]'::jsonb, '#C0C0C0', 'silver-medal', true),
  ('gold', 15000, 30000, 15.00, '["priority_booking", "birthday_bonus", "exclusive_services"]'::jsonb, '#FFD700', 'gold-medal', true),
  ('platinum', 30000, NULL, 20.00, '["priority_booking", "birthday_bonus", "exclusive_services", "vip_concierge"]'::jsonb, '#E5E4E2', 'platinum-medal', true)
ON CONFLICT (tier_name) DO UPDATE SET
  min_points = EXCLUDED.min_points,
  max_points = EXCLUDED.max_points,
  cashback_percentage = EXCLUDED.cashback_percentage,
  benefits = EXCLUDED.benefits,
  badge_color = EXCLUDED.badge_color,
  badge_icon = EXCLUDED.badge_icon;

-- ============================================
-- 5. DATABASE FUNCTIONS
-- ============================================

-- Function to calculate user tier based on lifetime points
CREATE OR REPLACE FUNCTION calculate_user_tier(p_user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_lifetime_points INTEGER;
  v_new_tier VARCHAR(20);
  v_current_tier VARCHAR(20);
BEGIN
  -- Get lifetime points
  SELECT lifetime_points_earned INTO v_lifetime_points
  FROM user_points
  WHERE user_id = p_user_id;
  
  IF v_lifetime_points IS NULL THEN
    RETURN 'bronze';
  END IF;
  
  -- Get current tier
  SELECT current_tier INTO v_current_tier
  FROM user_points
  WHERE user_id = p_user_id;
  
  -- Find matching tier
  SELECT tier_name INTO v_new_tier
  FROM loyalty_tiers
  WHERE v_lifetime_points >= min_points
    AND (max_points IS NULL OR v_lifetime_points < max_points)
    AND is_active = true
  ORDER BY min_points DESC
  LIMIT 1;
  
  -- If tier changed, update it
  IF v_new_tier IS NOT NULL AND v_new_tier != v_current_tier THEN
    UPDATE user_points
    SET current_tier = v_new_tier,
        tier_updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Log tier change transaction
    INSERT INTO points_transactions (
      user_id, transaction_type, points, balance_after,
      source_type, description, created_by
    ) VALUES (
      p_user_id, 'adjusted', 0,
      (SELECT points_balance FROM user_points WHERE user_id = p_user_id),
      'tier_upgrade',
      'Tier upgraded to ' || v_new_tier,
      'system'
    );
  END IF;
  
  RETURN COALESCE(v_new_tier, 'bronze');
END;
$$ LANGUAGE plpgsql;

-- Function to add points (atomic operation)
CREATE OR REPLACE FUNCTION add_points(
  p_user_id UUID,
  p_points INTEGER,
  p_source_type VARCHAR(50),
  p_source_id UUID,
  p_description TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
  v_lifetime_points INTEGER;
BEGIN
  -- Lock row for update
  PERFORM 1 FROM user_points WHERE user_id = p_user_id FOR UPDATE;
  
  -- Insert or update user_points
  INSERT INTO user_points (user_id, points_balance, lifetime_points_earned)
  VALUES (p_user_id, p_points, p_points)
  ON CONFLICT (user_id) DO UPDATE SET
    points_balance = user_points.points_balance + p_points,
    lifetime_points_earned = user_points.lifetime_points_earned + p_points,
    updated_at = NOW();
  
  -- Get new balance
  SELECT points_balance, lifetime_points_earned INTO v_new_balance, v_lifetime_points
  FROM user_points WHERE user_id = p_user_id;
  
  -- Log transaction
  INSERT INTO points_transactions (
    user_id, transaction_type, points, balance_after,
    source_type, source_id, description, created_by
  ) VALUES (
    p_user_id, 'earned', p_points, v_new_balance,
    p_source_type, p_source_id, p_description, 'system'
  );
  
  -- Check for tier upgrade
  PERFORM calculate_user_tier(p_user_id);
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to redeem points (atomic operation)
CREATE OR REPLACE FUNCTION redeem_points(
  p_user_id UUID,
  p_points_to_redeem INTEGER
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_discount_amount DECIMAL(10, 2);
BEGIN
  -- Get current balance with lock
  SELECT points_balance INTO v_current_balance
  FROM user_points
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user has enough points
  IF v_current_balance IS NULL OR v_current_balance < p_points_to_redeem THEN
    RAISE EXCEPTION 'Insufficient points. Available: %, Requested: %', 
      COALESCE(v_current_balance, 0), p_points_to_redeem;
  END IF;
  
  -- Calculate discount (100 points = ₹10)
  v_discount_amount := (p_points_to_redeem::DECIMAL / 10.0);
  
  -- Update balance
  UPDATE user_points
  SET points_balance = points_balance - p_points_to_redeem,
      lifetime_points_redeemed = lifetime_points_redeemed + p_points_to_redeem,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Get new balance
  SELECT points_balance INTO v_new_balance
  FROM user_points WHERE user_id = p_user_id;
  
  -- Log transaction
  INSERT INTO points_transactions (
    user_id, transaction_type, points, balance_after,
    source_type, description, created_by
  ) VALUES (
    p_user_id, 'redeemed', -p_points_to_redeem, v_new_balance,
    'redemption', NULL, 'Points redeemed for ₹' || v_discount_amount::TEXT, 'user'
  );
  
  RETURN v_discount_amount;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. TRIGGERS
-- ============================================

-- Trigger to auto-create user_points when user is created
CREATE OR REPLACE FUNCTION create_user_points()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_points (user_id, current_tier)
  VALUES (NEW.id, 'bronze')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_user_points
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_points();

-- Trigger to update updated_at for user_points
CREATE TRIGGER update_user_points_updated_at
  BEFORE UPDATE ON user_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at for loyalty_tiers
CREATE TRIGGER update_loyalty_tiers_updated_at
  BEFORE UPDATE ON loyalty_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. ADD POINTS_DISCOUNT COLUMN TO BOOKINGS
-- ============================================
-- Add column to track points discount if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'points_discount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN points_discount DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE bookings ADD COLUMN points_used INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Loyalty Points System database migration completed!';
  RAISE NOTICE '✅ Tables created: user_points, points_transactions, points_redemptions, loyalty_tiers';
  RAISE NOTICE '✅ Functions created: add_points(), redeem_points(), calculate_user_tier()';
  RAISE NOTICE '✅ Triggers created: auto-create user_points on user creation';
  RAISE NOTICE '✅ Default tiers seeded: Bronze, Silver, Gold, Platinum';
END $$;

