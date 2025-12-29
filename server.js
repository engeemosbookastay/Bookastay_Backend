import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bookingsRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';
import cron from 'node-cron';
import { syncFromAirbnb } from './services/airbnbSync.js';
import contactRoutes from './routes/contact.js';
import userRoutes from './routes/user.js';
import calendarRoutes from './routes/calendar.js';
import { supabase, connectSupabase } from './services/supabase.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'https://book-astay.vercel.app';
// app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));


// Run every 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('Running Airbnb calendar sync...');
  syncFromAirbnb();
});

const allowedOrigins = [
  // "https://omiiden-admin.vercel.app",
  // "https://omiiden-admin-page.vercel.app",
  // "https://omiiden.vercel.app",
  "http://localhost:5176",
  "https://book-astay.vercel.app",
  "https://booka-stay.vercel.app",
  "http://localhost:5175"
  
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.get('/', (req, res) => res.json({ status: 'ok' }));
app.use('/api', bookingsRoutes);
app.use('/api', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/auth', userRoutes);
app.use('/api/calendar', calendarRoutes);

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

export default app;
