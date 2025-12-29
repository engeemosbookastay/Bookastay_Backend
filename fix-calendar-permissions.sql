-- Fix Calendar Table Permissions
-- Run this in your Supabase SQL Editor

-- Option 1: Disable RLS on the calendar table (RECOMMENDED for internal sync tables)
ALTER TABLE calendar DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled, create policies instead
-- Uncomment the following if you prefer to use RLS with policies:

-- -- Enable RLS
-- ALTER TABLE calendar ENABLE ROW LEVEL SECURITY;
--
-- -- Allow service role to read all rows
-- CREATE POLICY "Service role can read calendar"
--   ON calendar
--   FOR SELECT
--   TO service_role
--   USING (true);
--
-- -- Allow service role to update all rows
-- CREATE POLICY "Service role can update calendar"
--   ON calendar
--   FOR UPDATE
--   TO service_role
--   USING (true);

-- Verify the calendar record exists
SELECT * FROM calendar WHERE platform = 'airbnb';
