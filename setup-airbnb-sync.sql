-- Setup Airbnb Calendar Sync
-- Run this in your Supabase SQL Editor

-- Insert the Airbnb calendar URL into your existing 'calendar' table
-- Include last_synced with NOW() to avoid null constraint violation
INSERT INTO calendar (platform, calendar_url, last_synced)
VALUES ('airbnb', 'https://www.airbnb.com/calendar/ical/1062424467186970425.ics?t=125d88f11e7e456bb36ccd50967bbfe2&locale=en-AU', NOW());

-- If a record already exists for airbnb, you can update it instead:
-- UPDATE calendar
-- SET calendar_url = 'https://www.airbnb.com/calendar/ical/1062424467186970425.ics?t=125d88f11e7e456bb36ccd50967bbfe2&locale=en-AU',
--     last_synced = NOW()
-- WHERE platform = 'airbnb';

-- Verify the record was created
SELECT * FROM calendar WHERE platform = 'airbnb';
