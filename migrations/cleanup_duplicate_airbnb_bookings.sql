-- Migration: Clean up duplicate Airbnb bookings BEFORE adding unique constraint
-- Run this FIRST if you have existing duplicate bookings
-- This script keeps only the most recent booking for each Airbnb UID

-- Step 1: View duplicates (run this first to see what will be deleted)
SELECT
    transaction_ref,
    COUNT(*) as duplicate_count,
    array_agg(id) as booking_ids,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM bookings
WHERE source = 'airbnb'
  AND transaction_ref IS NOT NULL
GROUP BY transaction_ref
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: Delete duplicates (keep the LATEST booking for each transaction_ref)
-- Uncomment and run this after reviewing the duplicates above
/*
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
*/

-- Step 3: Verify cleanup (should return 0 duplicates)
SELECT
    transaction_ref,
    COUNT(*) as count
FROM bookings
WHERE source = 'airbnb'
  AND transaction_ref IS NOT NULL
GROUP BY transaction_ref
HAVING COUNT(*) > 1;

-- Step 4: Fix dates for existing Airbnb bookings that have wrong check_out dates
-- This adjusts check_out to be DTEND - 1 day (last night stayed, not checkout morning)
-- WARNING: Only run this if you know your existing dates are wrong by 1 day
/*
UPDATE bookings
SET check_out = (check_out::date - INTERVAL '1 day')::date
WHERE source = 'airbnb'
  AND check_out > check_in;  -- Safety check
*/
