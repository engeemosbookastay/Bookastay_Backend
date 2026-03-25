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
import shuftiProRoutes from './routes/shuftiproroutes.js';

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5175",
  "http://localhost:5177",
  "https://book-astay.vercel.app",
  "https://booka-stay.vercel.app",
  "https://bookastay-admin.vercel.app",
  "https://admin.bookastayng.com",
  "https://bookastayng.com",
  "https://www.bookastayng.com",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
};

// Apply CORS before everything else so even error responses carry the header
app.use(cors(corsOptions));
// Handle pre-flight OPTIONS for all routes
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Run every 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('Running Airbnb calendar sync...');
  syncFromAirbnb();
});

// Ping self every 14 minutes to prevent Render free tier cold starts
cron.schedule('*/14 * * * *', async () => {
  const selfUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`;
  try {
    const mod = await import(selfUrl.startsWith('https') ? 'https' : 'http');
    mod.default.get(`${selfUrl}/`, () => {}).on('error', () => {});
  } catch {}
});

app.get('/', (req, res) => res.json({ status: 'ok' }));
app.use('/api', bookingsRoutes);
app.use('/api', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/auth', userRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/shufti', shuftiProRoutes);

// Global error handler — must stay last and must re-apply CORS header
// so browsers don't see a CORS failure when a route throws a 500
app.use((err, req, res, _next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  console.error('Unhandled error:', err.message || err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

const port = process.env.PORT || 4000;

async function start() {
  try {
    const res = await connectSupabase();
    if (!res.ok) {
      console.warn('Supabase connection: Contact table missing or schema mismatch.');
    }
  } catch (err) {
    console.error('FATAL: Supabase startup check failed:', err.message || err);
    process.exit(1);
  }

  app.listen(port, () => console.log(`Server running on port ${port}`));
}

start();

export default app;
