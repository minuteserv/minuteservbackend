-- Partner Management Enhancement Migration
-- Run this in Supabase SQL Editor

-- Add new columns to partners table
DO $$ 
BEGIN
    -- Commission settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'commission_rate') THEN
        ALTER TABLE partners ADD COLUMN commission_rate DECIMAL(5, 2) DEFAULT 70.00;
    END IF;
    
    -- Service area (pincodes)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'service_pincodes') THEN
        ALTER TABLE partners ADD COLUMN service_pincodes TEXT[];
    END IF;
    
    -- Availability schedule
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'availability_schedule') THEN
        ALTER TABLE partners ADD COLUMN availability_schedule JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Documents
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'documents') THEN
        ALTER TABLE partners ADD COLUMN documents JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Performance metrics
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'completion_rate') THEN
        ALTER TABLE partners ADD COLUMN completion_rate DECIMAL(5, 2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'average_response_time') THEN
        ALTER TABLE partners ADD COLUMN average_response_time INTEGER DEFAULT 0; -- in minutes
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'total_reviews') THEN
        ALTER TABLE partners ADD COLUMN total_reviews INTEGER DEFAULT 0;
    END IF;
    
    -- Address and personal info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'address') THEN
        ALTER TABLE partners ADD COLUMN address TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'city') THEN
        ALTER TABLE partners ADD COLUMN city VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'pincode') THEN
        ALTER TABLE partners ADD COLUMN pincode VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'date_of_birth') THEN
        ALTER TABLE partners ADD COLUMN date_of_birth DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'aadhaar_number') THEN
        ALTER TABLE partners ADD COLUMN aadhaar_number VARCHAR(12);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'pan_number') THEN
        ALTER TABLE partners ADD COLUMN pan_number VARCHAR(10);
    END IF;
    
    -- Bank details for payouts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'bank_account_number') THEN
        ALTER TABLE partners ADD COLUMN bank_account_number VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'bank_ifsc') THEN
        ALTER TABLE partners ADD COLUMN bank_ifsc VARCHAR(11);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'bank_name') THEN
        ALTER TABLE partners ADD COLUMN bank_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'account_holder_name') THEN
        ALTER TABLE partners ADD COLUMN account_holder_name VARCHAR(255);
    END IF;
    
    -- Onboarding status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'onboarding_status') THEN
        ALTER TABLE partners ADD COLUMN onboarding_status VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'onboarding_completed_at') THEN
        ALTER TABLE partners ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    RAISE NOTICE 'Partner management columns added successfully';
END $$;

-- Create partner_payouts table
CREATE TABLE IF NOT EXISTS partner_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    
    -- Payout details
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Payment method
    payment_method VARCHAR(50) DEFAULT 'bank_transfer',
    transaction_id VARCHAR(255),
    bank_reference_number VARCHAR(255),
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Metadata
    bookings_count INTEGER DEFAULT 0,
    notes TEXT,
    
    -- Timestamps
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_id ON partner_payouts(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status ON partner_payouts(status);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_period ON partner_payouts(period_start, period_end);

-- Create partner_performance_logs table for tracking metrics
CREATE TABLE IF NOT EXISTS partner_performance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    
    -- Metrics
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    response_time INTEGER, -- in minutes
    completion_time INTEGER, -- in minutes
    customer_rating DECIMAL(3, 2),
    
    -- Date
    logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_performance_logs_partner_id ON partner_performance_logs(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_performance_logs_date ON partner_performance_logs(logged_date);

-- Function to update partner performance metrics
CREATE OR REPLACE FUNCTION update_partner_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update completion rate
    UPDATE partners
    SET completion_rate = (
        SELECT 
            CASE 
                WHEN COUNT(*) > 0 THEN 
                    (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)::DECIMAL) * 100
                ELSE 0
            END
        FROM bookings
        WHERE partner_id = NEW.partner_id
    )
    WHERE id = NEW.partner_id;
    
    -- Update average response time
    UPDATE partners
    SET average_response_time = (
        SELECT COALESCE(AVG(response_time), 0)
        FROM partner_performance_logs
        WHERE partner_id = NEW.partner_id
        AND response_time IS NOT NULL
    )
    WHERE id = NEW.partner_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update performance metrics
DROP TRIGGER IF EXISTS trigger_update_partner_performance ON partner_performance_logs;
CREATE TRIGGER trigger_update_partner_performance
    AFTER INSERT ON partner_performance_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_performance();

-- Success message
DO $$ BEGIN RAISE NOTICE 'Partner management migration completed successfully!'; END $$;

