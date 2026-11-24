/**
 * Seed the content sections that have never been saved.
 *
 * WHY THIS EXISTS
 *   The website no longer ships any built-in text for the admin-editable
 *   sections — it shows only what is in site_content. Getting Around,
 *   Cancellation Policy and Privacy Policy were never saved from the admin, so
 *   they were being shown from text hardcoded in the frontend. This copies that
 *   exact text (scripts/content-seed.json) into the database so those pages keep
 *   their content once the frontend fallbacks are gone.
 *
 * Idempotent: a key that already has a row is skipped, never overwritten.
 *
 * USAGE   cd Backend && node scripts/seedMissingContent.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../services/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'content-seed.json'), 'utf8'));

const { data: existing, error } = await supabaseAdmin.from('site_content').select('key');
if (error) throw error;
const have = new Set((existing || []).map(r => r.key));

for (const [key, value] of Object.entries(seed)) {
  if (have.has(key)) { console.log(`skip   ${key} (already saved)`); continue; }
  const { error: insertError } = await supabaseAdmin
    .from('site_content')
    .insert({ key, title: key, value, updated_at: new Date().toISOString() });
  if (insertError) throw insertError;
  console.log(`seeded ${key}`);
}
