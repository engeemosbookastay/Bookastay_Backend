-- ============================================================
-- BookASTay New Features Migration — June 2026
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Property Settings table (dynamic rooms/listings)
CREATE TABLE IF NOT EXISTS property_settings (
  room_key        TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  subtitle        TEXT,
  description     TEXT,
  category        TEXT DEFAULT 'Private Room',
  base_price      NUMERIC NOT NULL DEFAULT 60000,
  max_guests      INTEGER DEFAULT 4,
  min_nights      INTEGER DEFAULT 1,
  bedrooms        INTEGER DEFAULT 1,
  bathrooms       INTEGER DEFAULT 1,
  images          TEXT[] DEFAULT '{}',
  amenities       JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default rooms matching existing hardcoded data
INSERT INTO property_settings (room_key, name, subtitle, description, category, base_price, max_guests, min_nights, bedrooms, bathrooms, sort_order)
VALUES
  (
    'entire',
    '2 Bedroom Apartment',
    'Spacious luxury apartment perfect for families',
    'Experience luxury in our spacious 2-bedroom apartment. Featuring modern amenities, a fully equipped kitchen, elegant living spaces, and stunning balconies with breathtaking views. Perfect for families or groups seeking comfort and privacy in the heart of Abeokuta.',
    'Entire Apartment',
    100000, 4, 1, 2, 2, 1
  ),
  (
    'room1',
    '1 Bedroom Suite',
    'Cozy and elegant for solo travelers or couples',
    'Your perfect retreat awaits! This beautifully designed 1-bedroom suite offers comfort and privacy with access to premium shared spaces. Ideal for solo travelers or couples seeking a peaceful escape with all the amenities you need.',
    'Private Room',
    60000, 2, 2, 1, 1, 2
  )
ON CONFLICT (room_key) DO NOTHING;

-- 2. Discount Codes table
CREATE TABLE IF NOT EXISTS discount_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value         NUMERIC NOT NULL,
  applies_to    TEXT[] DEFAULT NULL,       -- NULL = all rooms
  min_nights    INTEGER DEFAULT 1,
  min_amount    NUMERIC DEFAULT 0,
  expiry_date   DATE,
  usage_limit   INTEGER,                   -- NULL = unlimited
  times_used    INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Site Content table (editable page content)
CREATE TABLE IF NOT EXISTS site_content (
  key           TEXT PRIMARY KEY,
  title         TEXT,
  value         JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default About Us content
INSERT INTO site_content (key, title, value) VALUES
  ('about', 'About Us', '{
    "paragraphs": [
      "Engeemos Bookastay Ventures is a registered business name. We currently oversee hosting services for <strong>Oluwadarasimi Villa</strong> a block of flats boasting of modern facilities and aesthetically styled interior. Ensconced in a serene and secure part of <strong>Olomore</strong>, Abeokuta, this property is close to Lafenwa, Ita-Oshin, Brewery, Ibara-Omida, Oke-Ilewo, and just about 20-25 minutes of driving to Kuto/Oke-Mosan area and Olusegun Obasanjo Presidential Library.",
      "Rare find tourist attraction centres like the recently revamped Olumo Rock, the Kuti Heritage Museum and the Adire Mall, Itoku are just few minutes of driving away.",
      "At <strong>Engeemos Bookastay</strong>, we put <strong>guests'' satisfaction and privacy</strong> at the core of our service delivery, thus ensuring guests never felt like they have left their homes <strong>-a sharp contrast to the prevailing atmosphere at hotels</strong>.",
      "As part of our future plan, we intend to bring on board more verified, comfortable and guests-centric short stay accommodations."
    ]
  }')
ON CONFLICT (key) DO NOTHING;

-- Seed default Getting Around content
INSERT INTO site_content (key, title, value) VALUES
  ('getting_around', 'Getting Around', '{
    "categories": [
      {
        "key": "tourism",
        "title": "Tourism, Play & Games",
        "items": [
          {"name": "Olumo Rock (historical sightseeing point)", "time": "15-17 mins"},
          {"name": "Nike Art Gallery (same location as Olumo Rock)", "time": "15-17 mins"},
          {"name": "Kuti Heritage Museum, Isabo", "time": "15-17 mins"},
          {"name": "OOPL Wildlife Park (mini-zoo)", "time": "19-22 mins"},
          {"name": "OOPL Rounda Fun Spot", "time": "16-21 mins"},
          {"name": "Adonis Plaza Paintball and Games", "time": "21-25 mins"},
          {"name": "Funsation Games & Entertainment, Oke-Ilewo", "time": "13-15 mins"},
          {"name": "FoodCo Akin-Olugbade Social Centre (kids play area)", "time": "8 mins"},
          {"name": "OOPL Cinemas, Oke-Mosan", "time": "19-23 mins"},
          {"name": "OOPL Aje Place Cinemas & Lounge, Panseke", "time": "13 mins"},
          {"name": "Centenary Hall, Ake (historical sight)", "time": "15 mins"},
          {"name": "Alake Palace Ground", "time": "18 mins"},
          {"name": "Adire Mall, Itoku (for adire styles and prints)", "time": "15 mins"}
        ]
      },
      {
        "key": "food",
        "title": "Food & Dining",
        "items": [
          {"name": "Burger King Oke-Ilewo (fast food)", "time": "13 mins"},
          {"name": "SUPERFOODS Oke-Ilewo (fast food)", "time": "11 mins"},
          {"name": "Domino''s Pizza Abeokuta", "time": "10 mins"},
          {"name": "Sweet Sensation Oke-Ilewo (fast food)", "time": "12 mins"},
          {"name": "WokCity Restaurant Oke-Ilewo (multiple options)", "time": "12 mins"},
          {"name": "Halaga Restaurant (local food)", "time": "8 mins"},
          {"name": "South Kitchen & Lounge Ibara Housing (fine dining)", "time": "18-20 mins"},
          {"name": "Royal Mandarin Restaurant Ibara Housing (fine dining)", "time": "17 mins"}
        ]
      },
      {
        "key": "nightlife",
        "title": "Night Life (Clubs)",
        "items": [
          {"name": "F1 Nightclub Oke-Ilewo", "time": "12-13 mins"},
          {"name": "Cubana Abeokuta (luxury club)", "time": "18-20 mins"}
        ]
      },
      {
        "key": "shopping",
        "title": "Shopping",
        "items": [
          {"name": "FoodCo Supermarket, Oke-Ilewo", "time": "10 mins"},
          {"name": "Shoprite Abeokuta, Oke-Mosan", "time": "20-25 mins"},
          {"name": "Abeokuta Central Market (Ita-Eko)", "time": "15 mins"}
        ]
      },
      {
        "key": "transport",
        "title": "Transport Hubs",
        "items": [
          {"name": "Lafenwa Motor Park (to Lagos, Ibadan, etc.)", "time": "7-10 mins"},
          {"name": "Kuto Motor Park (interstate)", "time": "22-25 mins"},
          {"name": "Abeokuta Train Station", "time": "18-22 mins"}
        ]
      }
    ]
  }')
ON CONFLICT (key) DO NOTHING;

-- 4. Add new columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_type       TEXT DEFAULT 'full' CHECK (payment_type IN ('full', 'deposit'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 100;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_due        NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_code      TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount    NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_price     NUMERIC;

-- 5. iCal + property grouping support
ALTER TABLE property_settings ADD COLUMN IF NOT EXISTS ical_urls      TEXT[]  DEFAULT '{}';
ALTER TABLE property_settings ADD COLUMN IF NOT EXISTS property_group TEXT    DEFAULT NULL;
ALTER TABLE property_settings ADD COLUMN IF NOT EXISTS blocks_group   BOOLEAN DEFAULT false;

-- The 'entire' apartment blocks all rooms in its group
UPDATE property_settings SET property_group = 'main', blocks_group = true  WHERE room_key = 'entire';
UPDATE property_settings SET property_group = 'main', blocks_group = false WHERE room_key = 'room1';

-- ============================================================
-- Enable Row Level Security (RLS) for new tables
-- ============================================================
ALTER TABLE property_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

-- Allow public read on property_settings and site_content
CREATE POLICY "Public can read property_settings"
  ON property_settings FOR SELECT USING (true);

CREATE POLICY "Public can read site_content"
  ON site_content FOR SELECT USING (true);

-- Service role (used by backend) can do everything
CREATE POLICY "Service role full access property_settings"
  ON property_settings FOR ALL USING (true);

CREATE POLICY "Service role full access discount_codes"
  ON discount_codes FOR ALL USING (true);

CREATE POLICY "Service role full access site_content"
  ON site_content FOR ALL USING (true);
