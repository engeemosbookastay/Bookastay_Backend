// Resend the "New Booking" email (with PDF receipt) for a booking whose email failed.
//   node scripts/resendBookingEmail.js <bookingId>          → business email + copies
//   node scripts/resendBookingEmail.js <bookingId> --guest  → also the guest's confirmation
import 'dotenv/config';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from '../services/supabase.js';
import { sendClientNotification, sendCustomerEmail, generateReceiptPDF } from '../controllers/bookingsController.js';

const id = Number(process.argv[2]);
const alsoGuest = process.argv.includes('--guest');
if (!id) { console.error('Usage: node scripts/resendBookingEmail.js <bookingId> [--guest]'); process.exit(1); }

const { data: booking, error } = await supabaseAdmin.from('bookings').select('*').eq('id', id).maybeSingle();
if (error || !booking) { console.error('Booking not found:', error?.message || id); process.exit(1); }

// Price shown in the email = what the guest actually paid.
const notifyData = { ...booking, price: booking.paid_amount || booking.price };
const pdfPath = path.join(os.tmpdir(), `receipt_${booking.transaction_ref || id}.pdf`);
try {
  await generateReceiptPDF(notifyData, pdfPath);
  await sendClientNotification(notifyData, pdfPath);
  if (alsoGuest) await sendCustomerEmail(booking.email, notifyData, pdfPath);
  console.log(`Done — booking ${id} (${booking.name}) emails resent${alsoGuest ? ' incl. guest' : ''}.`);
} finally {
  try { fs.unlinkSync(pdfPath); } catch {}
  process.exit(0);
}
