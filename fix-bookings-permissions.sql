-- Fix Bookings Table Permissions for Airbnb Sync
-- Run this in your Supabase SQL Editor

-- Check current RLS status on bookings table
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'bookings';

-- Option 1: Disable RLS on bookings table (RECOMMENDED for sync to work)
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled, create policies for service role
-- Uncomment the following if you prefer to use RLS with policies:

-- -- Enable RLS
-- ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
--
-- -- Allow service role to insert bookings
-- CREATE POLICY "Service role can insert bookings"
--   ON bookings
--   FOR INSERT
--   TO service_role
--   WITH CHECK (true);
--
-- -- Allow service role to select bookings
-- CREATE POLICY "Service role can select bookings"
--   ON bookings
--   FOR SELECT
--   TO service_role
--   USING (true);
--
-- -- Allow service role to update bookings
-- CREATE POLICY "Service role can update bookings"
--   ON bookings
--   FOR UPDATE
--   TO service_role
--   USING (true);

-- Verify RLS is disabled
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'bookings';
