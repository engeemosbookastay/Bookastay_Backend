const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key must be provided in .env file');
}

// Public/anon client (safe for typical frontend-like operations used on server)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// Admin client using service role key (create if SERVICE_ROLE_KEY provided)
let supabaseAdmin = null;
if (supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  console.log('Supabase admin client configured');
} else {
  console.warn('SERVICE_ROLE_KEY not provided — admin client not configured');
}

const connectSupabase = async () => {
  const errors = [];
  try {
  const { error: userError } = await supabase.from('Users').select('id').limit(1);
  if (userError) errors.push(`Users table error: ${userError.message}`);
  else console.log('Connected to Users table successfully');

    const { error: contactError } = await supabase.from('Contact').select('id').limit(1);
    if (contactError) errors.push(`Contact table error: ${contactError.message}`);
    else console.log('Connected to Contact table successfully');

    const { error: bookingError } = await supabase.from('bookings').select('id').limit(1);
    if (bookingError) errors.push(`Bookings table error: ${bookingError.message}`);
    else console.log('Connected to Bookings table successfully');

    if (errors.length) {
      console.error('Supabase connection issues:', errors.join(' | '));
      return { ok: false, errors };
    }

    console.log('Supabase connection check completed successfully');
    return { ok: true };
  } catch (err) {
    console.error('Supabase connection failed:', err.message || err);
    return { ok: false, errors: [err.message || String(err)] };
  }
};

module.exports = { supabase, supabaseAdmin, connectSupabase };
