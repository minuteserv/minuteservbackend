-- Financial Management System Migration
-- Run this in Supabase SQL Editor

-- Extend partner_payouts table with additional fields
DO $$ 
BEGIN
    -- Add invoice number if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_payouts' AND column_name = 'invoice_number') THEN
        ALTER TABLE partner_payouts ADD COLUMN invoice_number VARCHAR(50) UNIQUE;
    END IF;
    
    -- Add GST details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_payouts' AND column_name = 'gst_amount') THEN
        ALTER TABLE partner_payouts ADD COLUMN gst_amount DECIMAL(10, 2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_payouts' AND column_name = 'gst_rate') THEN
        ALTER TABLE partner_payouts ADD COLUMN gst_rate DECIMAL(5, 2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_payouts' AND column_name = 'amount_before_gst') THEN
        ALTER TABLE partner_payouts ADD COLUMN amount_before_gst DECIMAL(10, 2);
    END IF;
    
    -- Add batch processing support
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_payouts' AND column_name = 'batch_id') THEN
        ALTER TABLE partner_payouts ADD COLUMN batch_id UUID;
    END IF;
    
    RAISE NOTICE 'Partner payouts table extended successfully';
END $$;

-- Create partner_invoices table
CREATE TABLE IF NOT EXISTS partner_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    payout_id UUID REFERENCES partner_payouts(id) ON DELETE SET NULL,
    
    -- Invoice details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    
    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL,
    gst_amount DECIMAL(10, 2) DEFAULT 0.00,
    gst_rate DECIMAL(5, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Invoice items (JSONB for flexibility)
    items JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
    
    -- Metadata
    notes TEXT,
    pdf_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_partner_invoices_partner_id ON partner_invoices(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_payout_id ON partner_invoices(payout_id);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_invoice_number ON partner_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_status ON partner_invoices(status);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_period ON partner_invoices(period_start, period_end);

-- Create payout_batches table for batch processing
CREATE TABLE IF NOT EXISTS payout_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Batch details
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Amounts
    total_amount DECIMAL(10, 2) NOT NULL,
    total_partners INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    
    -- Payment method
    payment_method VARCHAR(50) DEFAULT 'bank_transfer',
    transaction_id VARCHAR(255),
    bank_reference_number VARCHAR(255),
    
    -- Metadata
    notes TEXT,
    processed_by UUID, -- Admin user ID
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_date ON payout_batches(batch_date);

-- Add foreign key for batch_id in partner_payouts
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_partner_payouts_batch_id'
    ) THEN
        ALTER TABLE partner_payouts 
        ADD CONSTRAINT fk_partner_payouts_batch_id 
        FOREIGN KEY (batch_id) REFERENCES payout_batches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create gst_reports table for tax filing
CREATE TABLE IF NOT EXISTS gst_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Report period
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Revenue details
    total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    taxable_revenue DECIMAL(12, 2) DEFAULT 0.00,
    exempt_revenue DECIMAL(12, 2) DEFAULT 0.00,
    
    -- GST details
    cgst_amount DECIMAL(12, 2) DEFAULT 0.00,
    sgst_amount DECIMAL(12, 2) DEFAULT 0.00,
    igst_amount DECIMAL(12, 2) DEFAULT 0.00,
    total_gst DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Partner payouts
    total_payouts DECIMAL(12, 2) DEFAULT 0.00,
    payout_gst DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Net amounts
    net_revenue DECIMAL(12, 2) DEFAULT 0.00,
    net_payable DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'filed', 'paid')),
    
    -- Metadata
    notes TEXT,
    filed_at TIMESTAMP WITH TIME ZONE,
    filed_by UUID, -- Admin user ID
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gst_reports_period ON gst_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_gst_reports_status ON gst_reports(status);

-- Create pl_statements table for Profit & Loss tracking
CREATE TABLE IF NOT EXISTS pl_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Period
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Revenue
    total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    service_revenue DECIMAL(12, 2) DEFAULT 0.00,
    other_revenue DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Expenses
    partner_payouts DECIMAL(12, 2) DEFAULT 0.00,
    inventory_costs DECIMAL(12, 2) DEFAULT 0.00,
    marketing_costs DECIMAL(12, 2) DEFAULT 0.00,
    operational_costs DECIMAL(12, 2) DEFAULT 0.00,
    admin_costs DECIMAL(12, 2) DEFAULT 0.00,
    other_expenses DECIMAL(12, 2) DEFAULT 0.00,
    total_expenses DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Profit/Loss
    gross_profit DECIMAL(12, 2) DEFAULT 0.00,
    net_profit DECIMAL(12, 2) DEFAULT 0.00,
    profit_margin DECIMAL(5, 2) DEFAULT 0.00, -- Percentage
    
    -- Metadata
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pl_statements_period ON pl_statements(period_start, period_end);

-- Create payment_reconciliation table
CREATE TABLE IF NOT EXISTS payment_reconciliation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reconciliation period
    reconciliation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Expected vs Actual
    expected_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    actual_revenue DECIMAL(12, 2) DEFAULT 0.00,
    variance DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Expected vs Actual payouts
    expected_payouts DECIMAL(12, 2) DEFAULT 0.00,
    actual_payouts DECIMAL(12, 2) DEFAULT 0.00,
    payout_variance DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Discrepancies
    discrepancies JSONB DEFAULT '[]'::jsonb,
    discrepancy_count INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'resolved')),
    
    -- Resolved by
    resolved_by UUID, -- Admin user ID
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_date ON payment_reconciliation(reconciliation_date);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_status ON payment_reconciliation(status);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_period ON payment_reconciliation(period_start, period_end);

-- Create commission_calculations table for tracking commission calculations
CREATE TABLE IF NOT EXISTS commission_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    
    -- Calculation details
    booking_amount DECIMAL(10, 2) NOT NULL,
    commission_rate DECIMAL(5, 2) NOT NULL,
    commission_amount DECIMAL(10, 2) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'paid', 'cancelled')),
    
    -- Payout reference
    payout_id UUID REFERENCES partner_payouts(id) ON DELETE SET NULL,
    
    -- Timestamps
    calculated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_calculations_partner_id ON commission_calculations(partner_id);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_booking_id ON commission_calculations(booking_id);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_status ON commission_calculations(status);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_payout_id ON commission_calculations(payout_id);

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    invoice_prefix VARCHAR(10) := 'INV-';
    invoice_year VARCHAR(4) := TO_CHAR(CURRENT_DATE, 'YYYY');
    invoice_seq INTEGER;
    new_invoice_number VARCHAR(50);
BEGIN
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO invoice_seq
    FROM partner_invoices
    WHERE invoice_number LIKE invoice_prefix || invoice_year || '%';
    
    -- Generate invoice number: INV-YYYY-XXXXX
    new_invoice_number := invoice_prefix || invoice_year || '-' || LPAD(invoice_seq::TEXT, 5, '0');
    
    NEW.invoice_number := new_invoice_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invoice number
DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON partner_invoices;
CREATE TRIGGER trigger_generate_invoice_number
    BEFORE INSERT ON partner_invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL)
    EXECUTE FUNCTION generate_invoice_number();

-- Function to generate batch number
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TRIGGER AS $$
DECLARE
    batch_prefix VARCHAR(10) := 'BATCH-';
    batch_year VARCHAR(4) := TO_CHAR(CURRENT_DATE, 'YYYY');
    batch_seq INTEGER;
    new_batch_number VARCHAR(50);
BEGIN
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO batch_seq
    FROM payout_batches
    WHERE batch_number LIKE batch_prefix || batch_year || '%';
    
    -- Generate batch number: BATCH-YYYY-XXXXX
    new_batch_number := batch_prefix || batch_year || '-' || LPAD(batch_seq::TEXT, 5, '0');
    
    NEW.batch_number := new_batch_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate batch number
DROP TRIGGER IF EXISTS trigger_generate_batch_number ON payout_batches;
CREATE TRIGGER trigger_generate_batch_number
    BEFORE INSERT ON payout_batches
    FOR EACH ROW
    WHEN (NEW.batch_number IS NULL)
    EXECUTE FUNCTION generate_batch_number();

-- Function to auto-calculate commission when booking is completed
CREATE OR REPLACE FUNCTION calculate_partner_commission()
RETURNS TRIGGER AS $$
DECLARE
    partner_commission_rate DECIMAL(5, 2);
    commission_amount DECIMAL(10, 2);
BEGIN
    -- Only calculate for completed bookings
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Get partner commission rate
        SELECT COALESCE(commission_rate, 70.00) INTO partner_commission_rate
        FROM partners
        WHERE id = NEW.partner_id;
        
        -- Calculate commission (percentage of grand_total)
        commission_amount := (NEW.grand_total * partner_commission_rate / 100);
        
        -- Insert commission calculation record
        INSERT INTO commission_calculations (
            partner_id,
            booking_id,
            booking_amount,
            commission_rate,
            commission_amount,
            status,
            calculated_at
        ) VALUES (
            NEW.partner_id,
            NEW.id,
            NEW.grand_total,
            partner_commission_rate,
            commission_amount,
            'calculated',
            NOW()
        );
        
        -- Update partner's pending payout
        UPDATE partners
        SET pending_payout = COALESCE(pending_payout, 0) + commission_amount
        WHERE id = NEW.partner_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate commission
DROP TRIGGER IF EXISTS trigger_calculate_partner_commission ON bookings;
CREATE TRIGGER trigger_calculate_partner_commission
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION calculate_partner_commission();

-- Success message
DO $$ BEGIN RAISE NOTICE 'Financial management migration completed successfully!'; END $$;

