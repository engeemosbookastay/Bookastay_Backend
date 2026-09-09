import { supabaseAdmin } from '../services/supabase.js';
import nodemailer from 'nodemailer';

// Send OTP through the working qservers mailbox (not the dead Gmail account).
// Codes are still stored/verified in Supabase (email_verifications table).
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '26.qservers.net',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// ── Send OTP to email ──────────────────────────────────────────────
export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email address is required' });

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const { error: dbErr } = await supabaseAdmin.from('email_verifications').insert({
      email: email.toLowerCase().trim(),
      code,
      expires_at: expiresAt.toISOString(),
      verified: false,
    });

    if (dbErr) {
      console.error('OTP DB insert error:', dbErr.message);
      return res.status(500).json({ success: false, message: 'Could not save verification code' });
    }

    await transporter.sendMail({
      from: `"BookAStay" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your BookAStay Verification Code',
      html: `
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
      `,
    });

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

    const { data, error } = await supabaseAdmin
      .from('email_verifications')
      .select('id, code, expires_at, verified')
      .eq('email', email.toLowerCase().trim())
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.json({ success: true, verified: false, message: 'Code not found or has expired. Please request a new one.' });
    }

    if (data.code !== code.trim()) {
      return res.json({ success: true, verified: false, message: 'Incorrect code. Please try again.' });
    }

    await supabaseAdmin
      .from('email_verifications')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('id', data.id);

    console.log(`✅ Email verified: ${email}`);
    return res.json({ success: true, verified: true, message: 'Email verified!' });
  } catch (err) {
    console.error('verifyOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
};
