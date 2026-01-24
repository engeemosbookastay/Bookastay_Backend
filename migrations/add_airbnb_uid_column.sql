-- Migration: Add airbnb_uid column for proper Airbnb booking deduplication
-- Run this in your Supabase SQL Editor
-- IMPORTANT: Run each step one at a time!

-- ============================================
-- STEP 1: Add the columns (run this first)
-- ============================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS airbnb_uid TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website';

-- ============================================
-- STEP 2: View existing duplicates (run to see what will be cleaned)
-- ============================================
SELECT
    transaction_ref,
    COUNT(*) as duplicate_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM bookings
WHERE source = 'airbnb'
  AND transaction_ref IS NOT NULL
GROUP BY transaction_ref
HAVING COUNT(*) > 1;

-- ============================================
-- STEP 3: DELETE DUPLICATES - Keep only the LATEST booking for each UID
-- THIS IS THE FIX FOR YOUR ERROR!
-- ============================================
DELETE FROM bookings
WHERE id IN (
    SELECT id FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY transaction_ref
                ORDER BY created_at DESC
            ) as row_num
        FROM bookings
        WHERE source = 'airbnb'
          AND transaction_ref IS NOT NULL
    ) ranked
    WHERE row_num > 1
);

-- ============================================
-- STEP 4: Now set airbnb_uid from transaction_ref (no duplicates now!)
-- ============================================
UPDATE bookings
SET airbnb_uid = transaction_ref
WHERE source = 'airbnb'
  AND airbnb_uid IS NULL
  AND transaction_ref IS NOT NULL;

-- ============================================
-- STEP 5: Drop the old index if it exists (might have failed before)
-- ============================================
DROP INDEX IF EXISTS idx_bookings_airbnb_uid;

-- ============================================
-- STEP 6: NOW create the unique index (will succeed after cleanup)
-- ============================================
CREATE UNIQUE INDEX idx_bookings_airbnb_uid
ON bookings (airbnb_uid)
WHERE airbnb_uid IS NOT NULL;

-- ============================================
-- STEP 7: Create performance indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bookings_source ON bookings (source);
CREATE INDEX IF NOT EXISTS idx_bookings_dates_room ON bookings (check_in, check_out, room_type);

-- ============================================
-- VERIFICATION: Check everything is correct
-- ============================================
SELECT 'Columns added' as step, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name IN ('airbnb_uid', 'source');

-- Check no more duplicates
SELECT 'Duplicate check' as step, COUNT(*) as remaining_duplicates
FROM (
    SELECT transaction_ref FROM bookings
    WHERE source = 'airbnb' AND transaction_ref IS NOT NULL
    GROUP BY transaction_ref HAVING COUNT(*) > 1
) dups;
