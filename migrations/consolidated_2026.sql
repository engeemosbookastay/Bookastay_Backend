-- ============================================================================
-- BookAStay — CONSOLIDATED database script (2026)
--
-- ONE file that brings any BookAStay database fully up to date. Safe to run as
-- many times as you like (idempotent) — nothing here deletes data or overwrites
-- your admin-panel edits. Run it in the Supabase SQL editor, against the SAME
-- project your deployed backend uses.
--
-- Covers everything the current work needs plus the standing fixes:
--   1. pgcrypto extension (for UUIDs + password hashing)
--   2. site_content         — editable-content backbone (create if missing)
--   3. email_verifications  — OTP store (create if missing)
--   4. property_settings    — rooms/listings + iCal & grouping columns (safety)
--   5. discount_codes       — (create if missing)
--   6. admins               — creates the login row IF missing (login fix)
--   7. Rename any leftover "Oluwadarasimi Villa" -> "Engeemos Bookastay Apartments"
--   8. Starter rows for editable sections: footer, comparison, home_hero
--   9. Row-Level-Security policies (idempotent — safe to re-run)
--
-- NOTE: the customer-facing Cancellation Policy and Privacy Policy are now
-- editable from the admin panel, but they DO NOT need a row here — the website
-- and the admin editor both fall back to the built-in text until you save from
-- the admin, at which point the row is created automatically. So there is
-- nothing to seed for them.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid(), crypt(), gen_salt()

-- ---------------------------------------------------------------------------
-- 1. site_content — editable-content backbone (safety: create if missing)
--    Keys used by the app: about, house_rules, getting_around, footer,
--    comparison, home_hero, cancellation_policy, privacy_policy.
-- ---------------------------------------------------------------------------
create table if not exists site_content (
  key        text primary key,
  title      text,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 2. email_verifications — OTP store (safety: create if missing)
-- ---------------------------------------------------------------------------
create table if not exists email_verifications (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code        text not null,
  expires_at  timestamptz not null,
  verified    boolean default false,
  verified_at timestamptz,
  created_at  timestamptz default now()
);
create index if not exists idx_email_verifications_lookup
  on email_verifications (email, verified, expires_at desc);

-- ---------------------------------------------------------------------------
-- 3. property_settings — admin-managed rooms/listings (safety: create if
--    missing) plus the iCal + grouping columns. No rooms are seeded here:
--    properties are managed entirely from the admin panel.
-- ---------------------------------------------------------------------------
create table if not exists property_settings (
  room_key    text primary key,
  name        text not null,
  subtitle    text,
  description text,
  category    text default 'Private Room',
  base_price  numeric not null default 60000,
  max_guests  integer default 4,
  min_nights  integer default 1,
  bedrooms    integer default 1,
  bathrooms   integer default 1,
  images      text[] default '{}',
  amenities   jsonb default '[]',
  is_active   boolean default true,
  sort_order  integer default 0,
  updated_at  timestamptz default now()
);
alter table property_settings add column if not exists ical_urls      text[]  default '{}';
alter table property_settings add column if not exists property_group text    default null;
alter table property_settings add column if not exists blocks_group   boolean default false;

-- ---------------------------------------------------------------------------
-- 4. discount_codes (safety: create if missing)
-- ---------------------------------------------------------------------------
create table if not exists discount_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  type        text not null check (type in ('percentage', 'fixed')),
  value       numeric not null,
  applies_to  text[] default null,     -- null = all rooms
  min_nights  integer default 1,
  min_amount  numeric default 0,
  expiry_date date,
  usage_limit integer,                  -- null = unlimited
  times_used  integer default 0,
  is_active   boolean default true,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 5. admins — the admin-panel login row.
--    Creates the login ONLY IF it is missing (on conflict do nothing), so an
--    existing password you already use is NEVER changed by re-running this.
--    crypt()+gen_salt('bf') makes a $2a$ bcrypt hash the backend accepts.
--
--    Default seeded login (only when the row does not already exist):
--        email:    engeemosbookastay@gmail.com
--        password: BookAStay@2024
-- ---------------------------------------------------------------------------
create table if not exists admins (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  password   text not null,            -- bcrypt hash; bcryptjs.compare-compatible
  name       text,
  created_at timestamptz default now()
);

insert into admins (email, password, name) values (
  'engeemosbookastay@gmail.com',
  crypt('BookAStay@2024', gen_salt('bf', 10)),
  'Engeemos Admin'
) on conflict (email) do nothing;

-- OPTIONAL — only if you are ever locked out and want to FORCE the password
-- back to BookAStay@2024. It is commented out so a normal run never touches an
-- existing password. Remove the "-- " to use it, run once, then re-comment it.
-- update admins
--   set password = crypt('BookAStay@2024', gen_salt('bf', 10))
--   where email = 'engeemosbookastay@gmail.com';

-- ---------------------------------------------------------------------------
-- 6. Rename any leftover old property name in editable content.
--    Guarded by the WHERE clause, so it only runs where the old name is still
--    present and does nothing on later runs.
-- ---------------------------------------------------------------------------
update site_content
   set value      = replace(value::text, 'Oluwadarasimi Villa', 'Engeemos Bookastay Apartments')::jsonb,
       updated_at = now()
 where value::text like '%Oluwadarasimi Villa%';

-- ---------------------------------------------------------------------------
-- 7. Starter rows for the editable sections (only if absent — your admin edits
--    are never overwritten). The frontends also fall back to sensible defaults,
--    so these are a convenience.
-- ---------------------------------------------------------------------------

-- Footer: phones, email, address, social links (blank link = hidden).
insert into site_content (key, title, value) values (
  'footer', 'Footer',
  '{ "phones": [ { "label": "Phone", "number": "+234 816 693 9592" },
                 { "label": "WhatsApp", "number": "+234 806 621 5431" } ],
     "email": "engeemosbookastay@gmail.com",
     "address": "No 5, Adesola Babarinde Close, Off Professor Adewunmi Abioye Avenue, Olomore",
     "socials": { "whatsapp": "https://wa.me/2348066215431", "tiktok": "",
                  "facebook": "https://facebook.com/engeemosbookastay",
                  "instagram": "https://instagram.com/engeemos.bookastay",
                  "twitter": "https://twitter.com/engeemosbookastay" } }'::jsonb
) on conflict (key) do nothing;

-- Comparison table: 2 columns + editable rows
insert into site_content (key, title, value) values (
  'comparison', 'Price Comparison',
  '{ "heading": "Book Direct & Save",
     "subheading": "See how much you keep by booking with us instead of third-party sites.",
     "columns": { "ours": "Book Direct With Us", "theirs": "Booking.com / 3rd-Party" },
     "rows": [ { "label": "Nightly rate", "ours": "Best price", "theirs": "Same or higher" },
               { "label": "Service / booking fee", "ours": "None", "theirs": "Up to 15%" },
               { "label": "Payment", "ours": "Secure Paystack", "theirs": "Third-party processor" },
               { "label": "Support", "ours": "Direct with host", "theirs": "Call centre" } ],
     "footnote": "Prices are illustrative — edit these rows in the admin panel." }'::jsonb
) on conflict (key) do nothing;

-- Homepage hero carousel: image URLs + captions (empty slides = use bundled defaults)
insert into site_content (key, title, value) values (
  'home_hero', 'Homepage Carousel', '{ "slides": [] }'::jsonb
) on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Row-Level Security. Public gets READ-only on the two public tables; the
--    backend service role does everything. Written with drop-then-create so it
--    is safe to run repeatedly (plain CREATE POLICY errors if it already
--    exists). admins and email_verifications are intentionally left untouched —
--    they are only ever reached through the backend's service-role key.
-- ---------------------------------------------------------------------------
alter table property_settings enable row level security;
alter table site_content      enable row level security;
alter table discount_codes    enable row level security;

drop policy if exists "Public can read property_settings" on property_settings;
create policy "Public can read property_settings"
  on property_settings for select using (true);

drop policy if exists "Public can read site_content" on site_content;
create policy "Public can read site_content"
  on site_content for select using (true);

drop policy if exists "Service role full access property_settings" on property_settings;
create policy "Service role full access property_settings"
  on property_settings for all using (true);

drop policy if exists "Service role full access site_content" on site_content;
create policy "Service role full access site_content"
  on site_content for all using (true);

drop policy if exists "Service role full access discount_codes" on discount_codes;
create policy "Service role full access discount_codes"
  on discount_codes for all using (true);

-- ============================================================================
-- Done. Verify with:
--   select email, name from admins;
--   select key from site_content order by key;
-- ============================================================================
