/**
 * Restore the homepage carousel photos.
 *
 * WHY THIS EXISTS
 *   The saved `home_hero` row had all its slides stored with `url: ""`, and the
 *   homepage skips slides without a photo, so the hero stayed dark. This uploads
 *   the original slide photos to Cloudinary and writes their URLs back into the
 *   row. Captions/subtitles already saved by the admin are kept.
 *
 * Only slides that have no URL are filled in. Slides that already have a photo
 * are left as they are.
 *
 * USAGE   cd Backend && node scripts/restoreCarousel.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../services/supabase.js';
import { uploadBuffer } from '../services/cloudinaryClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '../../Frontend/src/assets');

// The original slide photos, in the order the captions were saved.
const PHOTOS = ['Room.jpg', 'LiveRoom.jpg', 'Bedroomss.jpg', 'Living.jpg', 'Dine.jpg', 'Bedroom.jpg'];

const { data: row, error } = await supabaseAdmin
  .from('site_content').select('*').eq('key', 'home_hero').maybeSingle();
if (error) throw error;

const slides = Array.isArray(row?.value?.slides) ? row.value.slides : [];
let photoIndex = 0;
const restored = [];
for (const slide of slides) {
  if (slide?.url || photoIndex >= PHOTOS.length) { restored.push(slide); continue; }
  const file = PHOTOS[photoIndex++];
  const uploaded = await uploadBuffer(fs.readFileSync(path.join(ASSETS, file)), `content_carousel_${file}`);
  console.log(`${file} → ${uploaded.secure_url}`);
  restored.push({ ...slide, url: uploaded.secure_url });
}

const { error: saveError } = await supabaseAdmin
  .from('site_content')
  .upsert(
    { key: 'home_hero', title: row?.title || 'home_hero', value: { ...(row?.value || {}), slides: restored }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
if (saveError) throw saveError;

console.log(`Restored ${photoIndex} slide photo(s).`);
