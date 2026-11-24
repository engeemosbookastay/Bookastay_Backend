-- Extra-guest pricing per apartment — everything is set by the admin
-- (Admin → Properties → edit apartment):
--   included_guests : how many guests the base price covers. The extra charge
--                     starts after this many (2 = 3rd & 4th guest pay extra,
--                     3 = only the 4th guest pays extra).
--   extra_guest_fee : ₦ added per night for each guest above included_guests (0 = no extra charge)
--   max_guests      : the most guests a booking can have (already existed)
-- Example: base 90,000, included 2, fee 10,000, max 4  →  2 guests 90k · 3 guests 100k · 4 guests 110k per night.
--
-- Bookings already made are NOT affected: each booking stores the amount that
-- was actually paid, and nothing recalculates old bookings from these settings.
--
-- Safe to run more than once. Run in the Supabase SQL editor.

-- 1. Columns
ALTER TABLE property_settings
  ADD COLUMN IF NOT EXISTS included_guests INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS extra_guest_fee NUMERIC NOT NULL DEFAULT 0;

-- 2. Guard against impossible values (e.g. a negative fee)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_settings_included_guests_check') THEN
    ALTER TABLE property_settings
      ADD CONSTRAINT property_settings_included_guests_check CHECK (included_guests >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_settings_extra_guest_fee_check') THEN
    ALTER TABLE property_settings
      ADD CONSTRAINT property_settings_extra_guest_fee_check CHECK (extra_guest_fee >= 0);
  END IF;
END $$;

-- 3. Refresh the API schema cache so the backend sees the columns immediately.
NOTIFY pgrst, 'reload schema';

-- 4. (Optional) Set the Two-Bedroom now instead of in the admin:
--    base 90k covers 2 guests, +10k per extra guest per night, max 4 guests.
-- UPDATE property_settings
--    SET included_guests = 2, extra_guest_fee = 10000, max_guests = 4
--  WHERE room_key = 'entire_apartment_(upstairs)';

-- 5. Check:
-- SELECT room_key, name, base_price, included_guests, extra_guest_fee, max_guests
--   FROM property_settings ORDER BY sort_order;
