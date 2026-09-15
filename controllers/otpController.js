import { supabaseAdmin } from '../services/supabase.js';
import nodemailer from 'nodemailer';

// Send OTP through the working qservers mailbox (not the dead Gmail account).
// Codes are still stored/verified in Supabase (email_verifications table).
//
// Reliability notes: this SMTP host (shared, port 465) intermittently times out
// from cloud hosts on cold starts. We use a pooled transporter with generous
// timeouts, retry the send a few times, and only record the code AFTER the mail
// actually goes out — so a failed send never blocks the guest's next attempt.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '26.qservers.net',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
  pool: true,
  maxConnections: 3,
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 30000,
});

// ── HTTP email transport (Google Apps Script web app) ───────────────────────
// The shared SMTP host (port 465) times out from Render, which blocks outbound
// SMTP. A Google Apps Script web app sends over HTTPS (443) — never blocked —
// using the owner's Gmail, the same mechanism already used for the Sheets
// webhook. OPT-IN: with no OTP_MAILER_URL set, behaviour is unchanged (SMTP
// only). Set EMAIL_TRANSPORT=http to use the mailer as the only sender.
//
// The web app is deployed "anyone with the link", so we send a shared secret it
// checks before sending — otherwise the public URL could be abused to send mail.
// The script only SENDS; the code is still generated, stored and verified here
// in the backend (Supabase email_verifications), so nothing sensitive lives in
// Google.
const OTP_MAILER_URL    = process.env.OTP_MAILER_URL;
const OTP_MAILER_SECRET = process.env.OTP_MAILER_SECRET || '';
const EMAIL_TRANSPORT   = (process.env.EMAIL_TRANSPORT || '').toLowerCase(); // '' | 'smtp' | 'http'
const httpEmailEnabled  = !!OTP_MAILER_URL;

// Verify SMTP connectivity once at boot so problems show up in the logs early,
// instead of only when the first guest tries to verify. Skipped when we run
// HTTP-only. Never throws.
if (EMAIL_TRANSPORT !== 'http') {
  transporter.verify()
    .then(() => console.log('✉️  SMTP transporter ready'))
    .catch((err) => console.error('⚠️  SMTP transporter NOT ready:', err.message));
}
if (httpEmailEnabled) {
  console.log(`✉️  HTTP email transport (Apps Script) enabled → ${OTP_MAILER_URL}`);
}

// Send one email by POSTing to the Apps Script web app (native fetch, Node 18+).
const sendViaHttpMailer = async ({ to, subject, html }) => {
  const resp = await fetch(OTP_MAILER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: OTP_MAILER_SECRET, to, subject, html }),
    redirect: 'follow', // Apps Script /exec replies with a 302 to googleusercontent
  });
  const text = await resp.text().catch(() => '');
  if (!resp.ok) throw new Error(`Mailer HTTP ${resp.status}: ${text.slice(0, 200)}`);
  let body = null;
  try { body = JSON.parse(text); } catch { /* Apps Script may return HTML on error */ }
  if (body && body.ok === false) throw new Error(`Mailer refused: ${body.error || 'unknown'}`);
  return body || {};
};

const RESEND_COOLDOWN_MS = 45 * 1000; // min gap between codes for one email
const OTP_TTL_MS = 10 * 60 * 1000;    // code lifetime

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const buildOtpEmail = (code) => `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
            <tr><td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">BookAStay</h1>
                    <p style="margin:4px 0 0;color:#e9d5ff;font-size:13px;">Engeemos Bookastay Ventures</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:36px 32px;text-align:center;">
                    <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">Your email verification code is</p>
                    <div style="display:inline-block;background:#0f172a;border:2px solid #7c3aed;border-radius:12px;padding:16px 40px;margin:16px 0;">
                      <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#f59e0b;font-family:monospace;">${code}</span>
                    </div>
                    <p style="margin:8px 0 0;color:#64748b;font-size:13px;">This code expires in <strong style="color:#94a3b8;">10 minutes</strong></p>
                    <p style="margin:24px 0 0;color:#64748b;font-size:12px;">If you did not request this, please ignore this email.</p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:16px 32px;border-top:1px solid #334155;text-align:center;">
                    <p style="margin:0;color:#475569;font-size:11px;">© ${new Date().getFullYear()} Engeemos Bookastay Ventures · Abeokuta, Nigeria</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
`;

// Try to send the mail a few times before giving up — most transient SMTP
// timeouts succeed on the second attempt.
const sendWithRetry = async (mailOptions, attempts = 3) => {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      lastErr = err;
      console.error(`sendMail attempt ${i}/${attempts} failed:`, err.message);
      if (i < attempts) await sleep(1000 * i); // 1s, 2s backoff
    }
  }
  throw lastErr;
};

// Deliver through whichever transport is available. EMAIL_TRANSPORT=http skips
// SMTP entirely (use when the SMTP host is known-unreachable, e.g. on Render).
// Otherwise SMTP is tried first and the Apps Script mailer is the automatic
// fallback when every SMTP attempt fails — so a timing-out mailbox no longer
// blocks verification.
const deliverOtpEmail = async (mailOptions) => {
  const httpPayload = { to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html };

  if (EMAIL_TRANSPORT === 'http') {
    if (!httpEmailEnabled) throw new Error('EMAIL_TRANSPORT=http but OTP_MAILER_URL is not set');
    return sendViaHttpMailer(httpPayload);
  }

  try {
    return await sendWithRetry(mailOptions);
  } catch (smtpErr) {
    if (httpEmailEnabled) {
      console.error('SMTP failed — falling back to Apps Script mailer:', smtpErr.message);
      return sendViaHttpMailer(httpPayload);
    }
    throw smtpErr;
  }
};

// ── Send OTP to email ──────────────────────────────────────────────
export const sendOtp = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail) return res.status(400).json({ success: false, message: 'Email address is required' });
    const email = rawEmail.toLowerCase().trim();

    // Resend cooldown — block hammering the mail server / inbox.
    const { data: recent } = await supabaseAdmin
      .from('email_verifications')
      .select('created_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const elapsed = Date.now() - new Date(recent.created_at).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${wait}s before requesting another code.`,
          retryAfter: wait,
        });
      }
    }

    const code = generateCode();

    // Send FIRST — only persist the code once the email actually goes out, so a
    // failed send doesn't leave an orphan row or trigger the cooldown.
    try {
      await deliverOtpEmail({
        from: `"BookAStay" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your BookAStay Verification Code',
        html: buildOtpEmail(code),
      });
    } catch (mailErr) {
      console.error('sendOtp mail error (all retries failed):', mailErr.message);
      return res.status(503).json({
        success: false,
        message: "We couldn't send your code right now. Please try again in a moment.",
      });
    }

    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const { error: dbErr } = await supabaseAdmin.from('email_verifications').insert({
      email,
      code,
      expires_at: expiresAt.toISOString(),
      verified: false,
    });

    if (dbErr) {
      console.error('OTP DB insert error:', dbErr.message);
      return res.status(500).json({ success: false, message: 'Could not save verification code. Please try again.' });
    }

    console.log(`✉️  OTP sent to ${email}`);
    return res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (err) {
    console.error('sendOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again.' });
  }
};

// ── Verify OTP ────────────────────────────────────────────────────
export const verifyOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Fetch the most recent code for this email (any state) so we can give a
    // specific reason rather than a single catch-all message.
    const { data: rec } = await supabaseAdmin
      .from('email_verifications')
      .select('id, code, expires_at, verified')
      .eq('email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rec) {
      return res.json({ success: true, verified: false, message: 'No verification code found. Please tap "Send Code" first.' });
    }
    if (rec.verified) {
      return res.json({ success: true, verified: false, message: 'That code was already used. Tap "Resend" to get a new one.' });
    }
    if (new Date(rec.expires_at).getTime() < Date.now()) {
      return res.json({ success: true, verified: false, message: 'Your code has expired. Tap "Resend" to get a new one.' });
    }
    if (rec.code !== code.trim()) {
      return res.json({ success: true, verified: false, message: 'Incorrect code. Please check the 6 digits and try again.' });
    }

    await supabaseAdmin
      .from('email_verifications')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('id', rec.id);

    console.log(`✅ Email verified: ${normalizedEmail}`);
    return res.json({ success: true, verified: true, message: 'Email verified!' });
  } catch (err) {
    console.error('verifyOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
};
