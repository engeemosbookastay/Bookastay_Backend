import fs from 'fs';
import path from 'path';

// Booking emails (guest confirmation + New Booking alert).
// Render blocks outbound SMTP, so on Render (EMAIL_TRANSPORT=http) mail goes through
// the Google Apps Script web app (apps-script/otp-mailer.gs) over HTTPS — the same
// mailer the OTP codes use. Elsewhere SMTP is tried first and the Apps Script mailer
// is the fallback, so a booking email is never silently lost.
const MAILER_URL = process.env.OTP_MAILER_URL;
const MAILER_SECRET = process.env.OTP_MAILER_SECRET || '';
const TRANSPORT = (process.env.EMAIL_TRANSPORT || '').toLowerCase(); // '' | 'smtp' | 'http'

const toList = (to) => (Array.isArray(to) ? to : String(to || '').split(','))
  .map(e => e.trim()).filter(Boolean);

const sendViaHttpMailer = async ({ to, subject, html, attachments = [] }) => {
  if (!MAILER_URL) throw new Error('OTP_MAILER_URL is not set');
  const files = attachments
    .filter(a => a?.path && fs.existsSync(a.path))
    .map(a => ({
      filename: a.filename || path.basename(a.path),
      mimeType: a.contentType || 'application/pdf',
      contentBase64: fs.readFileSync(a.path).toString('base64'),
    }));
  const resp = await fetch(MAILER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: MAILER_SECRET, to: toList(to).join(','), subject, html, attachments: files }),
    redirect: 'follow', // /exec answers with a 302 to googleusercontent
  });
  const text = await resp.text().catch(() => '');
  if (!resp.ok) throw new Error(`Mailer HTTP ${resp.status}: ${text.slice(0, 200)}`);
  let body = null;
  try { body = JSON.parse(text); } catch { /* Apps Script may return HTML on error */ }
  if (body && body.ok === false) throw new Error(`Mailer refused: ${body.error || 'unknown'}`);
  return { messageId: 'apps-script', ...(body || {}) };
};

export const deliverEmail = async (transporter, mailOptions) => {
  if (TRANSPORT === 'http') return sendViaHttpMailer(mailOptions);
  try {
    return await transporter.sendMail(mailOptions);
  } catch (smtpErr) {
    if (!MAILER_URL) throw smtpErr;
    console.warn('⚠️ SMTP failed, sending via Apps Script mailer instead:', smtpErr.message);
    return sendViaHttpMailer(mailOptions);
  }
};
