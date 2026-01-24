-- Migration: Add airbnb_uid column for proper Airbnb booking deduplication
-- Run this in your Supabase SQL Editor

-- Step 1: Add the airbnb_uid column (nullable to allow existing records)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS airbnb_uid TEXT;

-- Step 2: Add the source column if it doesn't exist (default to 'website' for existing bookings)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website';

-- Step 3: Create a unique index on airbnb_uid (only for non-null values)
-- This prevents duplicate Airbnb bookings while allowing website bookings (which have NULL airbnb_uid)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_airbnb_uid
ON bookings (airbnb_uid)
WHERE airbnb_uid IS NOT NULL;

-- Step 4: Update existing Airbnb bookings to use transaction_ref as airbnb_uid
-- (Only if they don't already have an airbnb_uid set)
UPDATE bookings
SET airbnb_uid = transaction_ref
WHERE source = 'airbnb'
  AND airbnb_uid IS NULL
  AND transaction_ref IS NOT NULL;

-- Step 5: Create index for faster source-based queries
CREATE INDEX IF NOT EXISTS idx_bookings_source
ON bookings (source);

-- Step 6: Create index for faster date + room_type lookups
CREATE INDEX IF NOT EXISTS idx_bookings_dates_room
ON bookings (check_in, check_out, room_type);

-- Verification: Check the new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('airbnb_uid', 'source');
