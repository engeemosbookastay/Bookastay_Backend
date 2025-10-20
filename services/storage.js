const fs = require('fs').promises;
const path = require('path');
const dataFile = path.join(__dirname, '..', 'data', 'bookings.json');
const { supabase, supabaseAdmin } = require('./supabase');

// Use Supabase when URL + anon/service key is present or admin client configured
const USE_SUPABASE = !!(supabase && (supabaseAdmin || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) );

async function ensureDataFile() {
  try {
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    await fs.access(dataFile).catch(async () => {
      await fs.writeFile(dataFile, JSON.stringify([]));
    });
  } catch (err) {
    console.error('ensureDataFile error', err);
  }
}

async function listBookings() {
  if (USE_SUPABASE) {
  const { data, error } = await supabase.from('bookings').select('*');
    if (error) throw error;
    return data || [];
  }
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  return JSON.parse(raw || '[]');
}

async function getBooking(id) {
  if (USE_SUPABASE) {
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data || null;
  }
  const bookings = await listBookings();
  return bookings.find(b => b.id === id) || null;
}

async function createBooking(booking) {
  if (USE_SUPABASE) {
    // upsert user first (safe no-op if user already exists)
    try {
      if (booking.user && booking.user.id) {
  const { id, name, email, phone } = booking.user;
  const isNumericId = /^[0-9]+$/.test(String(id || ''));
        // Try to find existing user by email first, then id.
        let existing = null;
        if (email) {
          const sel = await supabase.from('users').select('*').eq('email', email).maybeSingle();
          if (!sel.error) existing = sel.data;
        }
        if (!existing) {
          const sel2 = await supabase.from('users').select('*').eq('id', id).maybeSingle();
          if (!sel2.error) existing = sel2.data;
        }

        if (existing) {
          await supabase.from('users').update({ name, email, phone }).eq(existing.email ? 'email' : 'id', existing.email || existing.id);
        } else {
          const insertPayload = isNumericId ? { id, name, email, phone } : { name, email, phone };
          await supabase.from('users').insert(insertPayload);
        }
      }
    } catch (uErr) {
      console.warn('Warning: users upsert failed', uErr.message || uErr);
      // continue — booking insert may still succeed if foreign keys are not enforced
    }

    const { data, error } = await supabase.from('bookings').insert(booking).select().single();
    if (error) throw error;
    return data;
  }
  const bookings = await listBookings();
  bookings.push(booking);
  await fs.writeFile(dataFile, JSON.stringify(bookings, null, 2));
  return booking;
}

async function updateBooking(id, patch) {
  if (USE_SUPABASE) {
  const { data, error } = await supabase.from('bookings').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  const bookings = await listBookings();
  const idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) return null;
  bookings[idx] = { ...bookings[idx], ...patch };
  await fs.writeFile(dataFile, JSON.stringify(bookings, null, 2));
  return bookings[idx];
}

module.exports = {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
};
