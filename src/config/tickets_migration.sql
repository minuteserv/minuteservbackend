-- Tickets/Support System Migration
-- Run this in Supabase SQL Editor

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    
    -- Customer info
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    
    -- Ticket details
    subject VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    
    -- Related entities
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
    
    -- Status & Priority
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Assignment
    assigned_to VARCHAR(255),
    
    -- SLA
    sla_due_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'admin', -- admin, app, website, email, phone
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticket_responses table for conversation
CREATE TABLE IF NOT EXISTS ticket_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- Response info
    message TEXT NOT NULL,
    response_type VARCHAR(20) DEFAULT 'reply' CHECK (response_type IN ('reply', 'note', 'status_change', 'assignment')),
    
    -- Who responded
    responder_type VARCHAR(20) DEFAULT 'admin' CHECK (responder_type IN ('admin', 'customer', 'system')),
    responder_name VARCHAR(255),
    
    -- Attachments (URLs)
    attachments TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create response_templates table
CREATE TABLE IF NOT EXISTS response_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    content TEXT NOT NULL,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_booking_id ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket_id ON ticket_responses(ticket_id);

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ticket_number := 'TKT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number
DROP TRIGGER IF EXISTS set_ticket_number ON tickets;
CREATE TRIGGER set_ticket_number
    BEFORE INSERT ON tickets
    FOR EACH ROW
    WHEN (NEW.ticket_number IS NULL)
    EXECUTE FUNCTION generate_ticket_number();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS update_tickets_timestamp ON tickets;
CREATE TRIGGER update_tickets_timestamp
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_timestamp();

-- Insert default response templates
INSERT INTO response_templates (name, subject, content, category) VALUES
('Acknowledgment', 'We received your request', 'Thank you for contacting Minuteserv Support. We have received your request and our team is looking into it. You will receive an update within 24 hours.', 'general'),
('Refund Initiated', 'Refund has been initiated', 'We have initiated your refund of ₹{amount}. It will be credited to your original payment method within 5-7 business days.', 'refund'),
('Booking Rescheduled', 'Your booking has been rescheduled', 'Your booking has been successfully rescheduled to {new_date} at {new_time}. Our partner will arrive at your location as scheduled.', 'booking'),
('Issue Resolved', 'Your issue has been resolved', 'We are pleased to inform you that your issue has been resolved. If you have any further questions, please don''t hesitate to reach out.', 'resolution'),
('Apology', 'We apologize for the inconvenience', 'We sincerely apologize for the inconvenience caused. We take your feedback seriously and are working to ensure this doesn''t happen again.', 'apology')
ON CONFLICT DO NOTHING;

-- Enable RLS (Row Level Security)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth setup)
-- For now, allow all authenticated operations (customize as needed)
CREATE POLICY "Allow all operations on tickets" ON tickets FOR ALL USING (true);
CREATE POLICY "Allow all operations on ticket_responses" ON ticket_responses FOR ALL USING (true);
CREATE POLICY "Allow all operations on response_templates" ON response_templates FOR ALL USING (true);

-- Success message
DO $$ BEGIN RAISE NOTICE 'Tickets migration completed successfully!'; END $$;

