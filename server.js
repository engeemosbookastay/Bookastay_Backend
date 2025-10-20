require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bookingsRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(express.json());
app.use(cookieParser());
const contactRoutes = require('./routes/contact');
const userRoutes = require('./routes/user');
const { supabase, connectSupabase } = require('./services/supabase');

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));

app.get('/', (req, res) => res.json({ status: 'ok' }));
app.use('/api', bookingsRoutes);
app.use('/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/auth', userRoutes);

const port = process.env.PORT || 4000;

async function start() {
  // Try to connect to Supabase tables; connectSupabase will exit on failure
  try {
    const res = await connectSupabase();
    if (!res.ok) {
      console.warn('Supabase connection: Contact table missing or schema mismatch. Contact endpoint will fall back to local storage.');
    }
  } catch (err) {
    console.error('FATAL: Supabase startup check failed (auth/network):', err.message || err);
    process.exit(1);
  }

  app.listen(port, () => console.log(`Server running on port ${port}`));
}

start();

module.exports = app;
