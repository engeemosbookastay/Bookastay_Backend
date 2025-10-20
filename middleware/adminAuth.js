const { supabase } = require('../services/supabase');
require('dotenv').config();

// Admin auth supports either an ADMIN_API_KEY header or a Supabase bearer token
// If using Supabase token, set ADMIN_EMAILS env var to a comma separated list of admin emails
module.exports = async function adminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;
  const headerKey = req.headers['x-admin-key'];
  if (adminKey && headerKey && headerKey === adminKey) return next();

  const authHeader = req.headers.authorization?.replace('Bearer ', '');
  if (!authHeader) {
    return res.status(401).json({ error: 'Admin auth required' });
  }

  try {
    if (!supabase) {
      // Supabase not configured - require admin key instead
      return res.status(401).json({ error: 'Server not configured for Supabase admin auth; use x-admin-key header' });
    }
    const { data, error } = await supabase.auth.getUser(authHeader);
    if (error) return res.status(401).json({ error: 'Invalid token' });
    const user = data.user;
    const adminEnv = process.env.ADMIN_EMAILS || '';
    const admins = adminEnv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (admins.includes(user.email?.toLowerCase())) return next();
    return res.status(403).json({ error: 'Forbidden: admin only' });
  } catch (err) {
    console.error('adminAuth error', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
