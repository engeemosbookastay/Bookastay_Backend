/**
 * One-shot: back up and then DELETE every row in property_settings.
 *
 * WHY
 *   Properties are now managed exclusively from the admin panel. This clears
 *   the seeded/demo rooms so the site starts from a blank slate and every
 *   property from here on is one you add through Admin → Properties.
 *
 * SAFETY
 *   Before deleting, it writes a timestamped backup next to this file
 *   (properties-backup-<time>.json) so the wipe is reversible.
 *
 * RUN
 *   node Backend/scripts/wipeProperties.js
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { supabaseAdmin } = await import('../services/supabase.js');

if (!supabaseAdmin) {
  console.error('\n✖ supabaseAdmin is not configured. Add SERVICE_ROLE_KEY to Backend/.env and retry.\n');
  process.exit(1);
}

async function run() {
  console.log('\nReading all properties…');
  const { data: rows, error: readErr } = await supabaseAdmin
    .from('property_settings')
    .select('*');
  if (readErr) {
    console.error('✖ Could not read property_settings:', readErr.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('✓ property_settings is already empty — nothing to delete.\n');
    process.exit(0);
  }

  // Back up first
  const backupPath = path.join(__dirname, `properties-backup-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(rows, null, 2));
  console.log(`✓ Backed up ${rows.length} row(s) → ${backupPath}`);

  // Delete every row by its primary key
  const keys = rows.map((r) => r.room_key);
  const { error: delErr } = await supabaseAdmin
    .from('property_settings')
    .delete()
    .in('room_key', keys);
  if (delErr) {
    console.error('✖ Delete failed:', delErr.message);
    console.error('  (If this is a foreign-key error, some bookings reference these rooms.)');
    process.exit(1);
  }

  const { count } = await supabaseAdmin
    .from('property_settings')
    .select('*', { count: 'exact', head: true });

  console.log(`✓ Deleted ${keys.length} property(ies): ${keys.join(', ')}`);
  console.log(`✓ property_settings now holds ${count ?? 0} row(s).`);
  console.log('\nDone. Add your real properties from Admin → Properties.\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('✖ Unexpected error:', err.message || err);
  process.exit(1);
});
