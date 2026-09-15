/************************************************************************************
 * BookAStay — OTP Email Mailer  (Google Apps Script Web App)
 * ---------------------------------------------------------------------------------
 * WHAT THIS IS
 *   A tiny web app that sends ONE email when the BookAStay backend asks it to.
 *   It exists because our mail host (port 465 SMTP) is blocked on Render, so the
 *   backend cannot send mail directly. Google sends over HTTPS (port 443), which
 *   is never blocked — so this always works.
 *
 *   This is a SEPARATE script from the Google Sheet booking webhook. It does ONE
 *   job: send the verification-code email. It does NOT generate or check codes —
 *   the BookAStay backend still does that (in Supabase). Google only delivers the
 *   email.
 *
 * ---------------------------------------------------------------------------------
 * HOW TO DEPLOY  (do this once)
 *   1.  Go to  https://script.google.com  and sign in with the Gmail account that
 *       should SEND the codes (e.g. engeemosbookastay@gmail.com).
 *   2.  Click  + New project.  Delete whatever code is there.
 *   3.  Paste THIS ENTIRE FILE in.
 *   4.  Change SHARED_SECRET below to your own long random text (see the line).
 *       Keep a copy — you must give the SAME value to the backend (step 8).
 *   5.  Click  Deploy ▸ New deployment.
 *   6.  Click the gear ⚙ next to "Select type" ▸ choose  Web app.
 *   7.  Set:
 *          Description:      BookAStay OTP mailer
 *          Execute as:       Me  (your email)
 *          Who has access:   Anyone
 *       Click  Deploy.  Approve/allow the permissions when Google asks
 *       (it needs permission to send email as you — that is expected).
 *   8.  Copy the  Web app URL  (ends in  /exec ).  Send BOTH of these to the
 *       developer / put them in the backend's Render environment variables:
 *          OTP_MAILER_URL     = <the /exec URL you copied>
 *          OTP_MAILER_SECRET  = <the SHARED_SECRET you set in step 4>
 *          EMAIL_TRANSPORT    = http
 *
 * TO TEST WITHOUT THE BACKEND
 *   Open the /exec URL in a browser — you should see  {"ok":true,"service":...}.
 *   That confirms it is deployed and reachable (it does NOT send mail on a plain
 *   visit — only the backend's POST does).
 *
 * IF YOU EVER CHANGE THE CODE
 *   Deploy ▸ Manage deployments ▸ edit ▸ Version: New version ▸ Deploy.
 *   The /exec URL stays the same, so you do NOT need to update the backend.
 ************************************************************************************/

// ⬇️  CHANGE THIS to your own long random string, then give the same value to the
//     backend as OTP_MAILER_SECRET. It stops strangers who find the URL from
//     using it to send email. (You can also set a Script Property named
//     OTP_MAILER_SECRET instead of editing this line — that takes priority.)
var SHARED_SECRET = 'CHANGE_ME_to_a_long_random_secret';

var SENDER_NAME = 'BookAStay';   // display name recipients see in the "From" field

// ── The backend POSTs here to send one email ───────────────────────────────────
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ ok: false, error: 'no_body' });
    }

    var data = JSON.parse(e.postData.contents);
    var secret = _secret();

    // Reject anyone who doesn't know the shared secret.
    if (secret && data.secret !== secret) {
      return _json({ ok: false, error: 'unauthorized' });
    }

    var to = (data.to || '').toString().trim();
    var subject = (data.subject || 'Your BookAStay Verification Code').toString();
    var html = (data.html || '').toString();

    if (!to) return _json({ ok: false, error: 'missing_to' });
    if (!html) return _json({ ok: false, error: 'missing_html' });

    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: html,
      body: _stripHtml(html),   // plain-text fallback for old email clients
      name: SENDER_NAME,
    });

    return _json({ ok: true, remainingQuota: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return _json({ ok: false, error: (err && err.message) ? err.message : String(err) });
  }
}

// ── Health check: opening the URL in a browser confirms it's live ───────────────
function doGet() {
  return _json({ ok: true, service: 'bookastay-otp-mailer', note: 'POST to send mail' });
}

// ── helpers ─────────────────────────────────────────────────────────────────────
function _secret() {
  // A Script Property named OTP_MAILER_SECRET wins over the constant above, so
  // the secret can be rotated without editing code.
  var fromProps = PropertiesService.getScriptProperties().getProperty('OTP_MAILER_SECRET');
  if (fromProps && fromProps.trim()) return fromProps.trim();
  return (SHARED_SECRET && SHARED_SECRET !== 'CHANGE_ME_to_a_long_random_secret')
    ? SHARED_SECRET
    : '';   // empty => secret check is skipped (NOT recommended for production)
}

function _stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
