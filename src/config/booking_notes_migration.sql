-- Booking Notes Migration
-- Run this in Supabase SQL Editor if admin_notes column doesn't exist

-- Add admin_notes column to bookings table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'admin_notes'
    ) THEN
        ALTER TABLE bookings 
        ADD COLUMN admin_notes JSONB DEFAULT '[]'::jsonb;
        
        RAISE NOTICE 'admin_notes column added to bookings table';
    ELSE
        RAISE NOTICE 'admin_notes column already exists';
    END IF;
END $$;

-- Success message
DO $$ BEGIN RAISE NOTICE 'Booking notes migration completed!'; END $$;

