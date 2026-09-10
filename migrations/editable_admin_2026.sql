-- ============================================================================
-- BookAStay — Editable Admin + Login Fix migration (2026)
--
-- Safe to run multiple times (idempotent). Run in the Supabase SQL editor
-- against the SAME project your deployed backend uses.
--
-- What it does:
--   1. site_content         — editable-content backbone (create if missing)
--   2. email_verifications  — OTP store (create if missing)
--   3. admins               — FIXES THE ADMIN LOGIN 401 (create + seed row)
--   4. Seeds starter rows for the new editable sections: footer, comparison,
--      home_hero (only if absent — your admin edits are never overwritten)
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid(), crypt(), gen_salt()

-- ---------------------------------------------------------------------------
-- 1. site_content — editable-content backbone (safety: create if missing)
--    Existing keys: about, house_rules, getting_around.
--    New keys added below: footer, comparison, home_hero.
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
-- 3. admins — FIXES THE 401.
--    The table had no SQL definition in the repo and the prod row was never
--    seeded, so adminLogin found no match and returned 401. This creates the
--    table and seeds the login. crypt()+gen_salt('bf') produces a $2a$ bcrypt
--    hash that the backend's bcryptjs.compare() accepts.
-- ---------------------------------------------------------------------------
create table if not exists admins (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  password   text not null,           -- bcrypt hash; bcryptjs.compare-compatible
  name       text,
  created_at timestamptz default now()
);

insert into admins (email, password, name) values (
  'engeemosbookastay@gmail.com',
  crypt('BookAStay@2024', gen_salt('bf', 10)),
  'Engeemos Admin'
) on conflict (email) do update
  set password = excluded.password,
      name     = excluded.name;

-- ---------------------------------------------------------------------------
-- 4. Starter rows for the new editable sections (only if absent — admin edits
--    are never overwritten). The frontends also fall back to sensible defaults,
--    so these seeds are an optional convenience.
-- ---------------------------------------------------------------------------

-- Footer: phones, email, address, social links (blank link = hidden).
-- Values mirror the current hardcoded footer so running this changes nothing
-- visually — the admin edits from here.
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
