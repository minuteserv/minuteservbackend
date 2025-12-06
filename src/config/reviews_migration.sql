-- ============================================
-- Reviews & Ratings Database Migration
-- Customer Experience Management System for Minuteserv
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    
    -- Rating (1-5 stars)
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    
    -- Review content
    title VARCHAR(255),
    comment TEXT,
    
    -- Review status
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, hidden
    moderation_notes TEXT,
    moderated_by UUID REFERENCES admin_users(id),
    moderated_at TIMESTAMP WITH TIME ZONE,
    
    -- Admin response
    admin_response TEXT,
    admin_response_by UUID REFERENCES admin_users(id),
    admin_response_at TIMESTAMP WITH TIME ZONE,
    
    -- Review metadata
    helpful_count INTEGER DEFAULT 0, -- How many found it helpful
    verified_purchase BOOLEAN DEFAULT true, -- Customer actually used the service
    display_name VARCHAR(255), -- Optional display name
    
    -- Categorization for analysis
    sentiment VARCHAR(50), -- positive, negative, neutral (can be auto-analyzed)
    categories JSONB DEFAULT '[]'::jsonb, -- complaint, praise, suggestion, etc.
    tags JSONB DEFAULT '[]'::jsonb, -- Custom tags
    
    -- Images/Videos
    images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
    videos JSONB DEFAULT '[]'::jsonb, -- Array of video URLs
    
    -- Metadata
    is_featured BOOLEAN DEFAULT false, -- Featured review
    is_anonymous BOOLEAN DEFAULT false, -- Anonymous review
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_booking_review CHECK (
        booking_id IS NOT NULL OR (booking_id IS NULL AND verified_purchase = false)
    )
);

-- Indexes for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_partner_id ON reviews(partner_id);
CREATE INDEX IF NOT EXISTS idx_reviews_service_id ON reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(status, rating) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_reviews_featured ON reviews(is_featured) WHERE is_featured = true;

-- ============================================
-- 2. REVIEW RESPONSES TABLE (Thread for replies)
-- ============================================
CREATE TABLE IF NOT EXISTS review_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    parent_response_id UUID REFERENCES review_responses(id) ON DELETE CASCADE, -- For nested replies
    responder_type VARCHAR(50) NOT NULL, -- admin, partner, customer
    responder_id UUID NOT NULL, -- admin_user id, partner id, or user id
    response_text TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for review_responses
CREATE INDEX IF NOT EXISTS idx_review_responses_review_id ON review_responses(review_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_parent_id ON review_responses(parent_response_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_responder ON review_responses(responder_type, responder_id);

-- ============================================
-- 3. REVIEW HELPFUL VOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_helpful_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, user_id)
);

-- Indexes for review_helpful_votes
CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_review_id ON review_helpful_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_user_id ON review_helpful_votes(user_id);

-- ============================================
-- 4. REVIEW MODERATION HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_moderation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- approved, rejected, hidden, edited, deleted
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    notes TEXT,
    moderated_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for review_moderation_history
CREATE INDEX IF NOT EXISTS idx_review_moderation_history_review_id ON review_moderation_history(review_id);
CREATE INDEX IF NOT EXISTS idx_review_moderation_history_moderated_by ON review_moderation_history(moderated_by);
CREATE INDEX IF NOT EXISTS idx_review_moderation_history_action ON review_moderation_history(action);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers (drop if exists first to avoid conflicts)
DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_reviews_updated_at();

-- Function to update updated_at timestamp (reuse if exists, otherwise create)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_review_responses_updated_at ON review_responses;
CREATE TRIGGER update_review_responses_updated_at BEFORE UPDATE ON review_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update review helpful count
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE reviews
    SET helpful_count = (
        SELECT COUNT(*) 
        FROM review_helpful_votes 
        WHERE review_id = COALESCE(NEW.review_id, OLD.review_id) 
        AND is_helpful = true
    )
    WHERE id = COALESCE(NEW.review_id, OLD.review_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to update helpful count (drop if exists first)
DROP TRIGGER IF EXISTS update_helpful_count_trigger ON review_helpful_votes;
CREATE TRIGGER update_helpful_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON review_helpful_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_review_helpful_count();

-- Function to record moderation history
CREATE OR REPLACE FUNCTION record_moderation_history()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.comment IS DISTINCT FROM NEW.comment) THEN
        INSERT INTO review_moderation_history (
            review_id,
            action,
            previous_status,
            new_status,
            notes,
            moderated_by
        )
        VALUES (
            NEW.id,
            CASE 
                WHEN NEW.status = 'approved' THEN 'approved'
                WHEN NEW.status = 'rejected' THEN 'rejected'
                WHEN NEW.status = 'hidden' THEN 'hidden'
                WHEN OLD.comment IS DISTINCT FROM NEW.comment THEN 'edited'
                ELSE 'updated'
            END,
            OLD.status,
            NEW.status,
            NEW.moderation_notes,
            NEW.moderated_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to record moderation history (drop if exists first)
DROP TRIGGER IF EXISTS record_moderation_history_trigger ON reviews;
CREATE TRIGGER record_moderation_history_trigger
    AFTER UPDATE ON reviews
    FOR EACH ROW
    WHEN (
        (OLD.status IS DISTINCT FROM NEW.status) OR 
        (OLD.comment IS DISTINCT FROM NEW.comment) OR
        (OLD.moderation_notes IS DISTINCT FROM NEW.moderation_notes)
    )
    EXECUTE FUNCTION record_moderation_history();

-- Function to calculate average rating for service/partner
CREATE OR REPLACE FUNCTION calculate_average_rating(entity_type VARCHAR, entity_id UUID)
RETURNS TABLE (
    average_rating NUMERIC,
    total_reviews BIGINT,
    rating_distribution JSONB
) AS $$
BEGIN
    IF entity_type = 'service' THEN
        RETURN QUERY
        SELECT 
            ROUND(AVG(rating)::numeric, 2) as average_rating,
            COUNT(*)::bigint as total_reviews,
            jsonb_build_object(
                '5', COUNT(*) FILTER (WHERE rating = 5),
                '4', COUNT(*) FILTER (WHERE rating = 4),
                '3', COUNT(*) FILTER (WHERE rating = 3),
                '2', COUNT(*) FILTER (WHERE rating = 2),
                '1', COUNT(*) FILTER (WHERE rating = 1)
            ) as rating_distribution
        FROM reviews
        WHERE service_id = entity_id
        AND status = 'approved';
    ELSIF entity_type = 'partner' THEN
        RETURN QUERY
        SELECT 
            ROUND(AVG(rating)::numeric, 2) as average_rating,
            COUNT(*)::bigint as total_reviews,
            jsonb_build_object(
                '5', COUNT(*) FILTER (WHERE rating = 5),
                '4', COUNT(*) FILTER (WHERE rating = 4),
                '3', COUNT(*) FILTER (WHERE rating = 3),
                '2', COUNT(*) FILTER (WHERE rating = 2),
                '1', COUNT(*) FILTER (WHERE rating = 1)
            ) as rating_distribution
        FROM reviews
        WHERE partner_id = entity_id
        AND status = 'approved';
    END IF;
END;
$$ language 'plpgsql';

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE reviews IS 'Customer reviews and ratings';
COMMENT ON TABLE review_responses IS 'Responses/replies to reviews (admin, partner, or customer)';
COMMENT ON TABLE review_helpful_votes IS 'Votes on whether reviews are helpful';
COMMENT ON TABLE review_moderation_history IS 'History of review moderation actions';

