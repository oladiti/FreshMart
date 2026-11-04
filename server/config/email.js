// Provider-agnostic transactional email.
//
// The default provider is the Gmail API (an HTTPS API), because many hosts --
// notably Render's free tier -- block outbound traffic to SMTP ports 25/465/587.
// Sending over HTTPS/443 sidesteps that block and needs no verified domain: it
// just needs an OAuth refresh token for a Gmail account. Resend (also HTTPS) and
// a legacy SMTP transport are kept behind EMAIL_PROVIDER purely as alternatives,
// so switching is an environment change rather than a code revert.
import crypto from 'crypto';
import { Resend } from 'resend';

const PROVIDER = (process.env.EMAIL_PROVIDER || 'gmail_api').toLowerCase();
const TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 10000);

// Gmail only sends as the authenticated account (or a verified alias), so the
// sender must resolve to that address rather than an arbitrary domain.
const DEFAULT_FROM =
  PROVIDER === 'gmail_api'
    ? process.env.GMAIL_SENDER || process.env.EMAIL_USER || 'me'
    : 'FreshMart <onboarding@resend.dev>';
const FROM = process.env.EMAIL_FROM || DEFAULT_FROM;

let resendClient = null;
const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
};

// Whether outbound email is configured. Single source of truth used by the
// controllers to decide whether an attempt is worthwhile (and, when it isn't,
// whether to surface a local development fallback link).
export const isEmailConfigured = () => {
  if (PROVIDER === 'smtp') {
    return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  }
  if (PROVIDER === 'gmail_api') {
    return Boolean(
      process.env.GMAIL_CLIENT_ID &&
        process.env.GMAIL_CLIENT_SECRET &&
        process.env.GMAIL_REFRESH_TOKEN
    );
  }
  return Boolean(process.env.RESEND_API_KEY);
};

// Reject a send that never settles so a hung provider can't hold a request
// open. Mirrors the connection/greeting/socket bounds the SMTP transport used.
const withTimeout = (promise, ms, label) => {
  let timer;
  // Swallow a late settlement of the original promise so that, if the timeout
  // wins the race, a subsequent rejection doesn't surface as unhandled.
  const guarded = promise.finally(() => clearTimeout(timer));
  guarded.catch(() => {});
  return Promise.race([
    guarded,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms
      );
    }),
  ]);
};

// Legacy SMTP transport. Loaded lazily so the Resend path never pays for it.
const sendViaSmtp = async (message) => {
  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
  return transporter.sendMail(message);
};

// --- Gmail API (HTTPS) -----------------------------------------------------

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// Cache the short-lived access token so a burst of sends performs one exchange.
let gmailAccessToken = null;
let gmailAccessTokenExpiresAt = 0;

const getGmailAccessToken = async () => {
  if (gmailAccessToken && Date.now() < gmailAccessTokenExpiresAt - 60000) {
    return gmailAccessToken;
  }
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`Gmail token exchange failed (${res.status})`);
  }
  const data = await res.json();
  gmailAccessToken = data.access_token;
  gmailAccessTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return gmailAccessToken;
};

// Build an RFC 5322 multipart/alternative message and base64url-encode it, the
// shape the Gmail API expects in the `raw` field.
const buildMime = ({ from, to, subject, html, text, replyTo }) => {
  const boundary = `fm_${crypto.randomBytes(12).toString('hex')}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join('\r\n');

  const part = (type, body) =>
    `--${boundary}\r\nContent-Type: ${type}; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    Buffer.from(body || '').toString('base64');

  const mime =
    `${headers}\r\n\r\n${part('text/plain', text || '')}\r\n` +
    `${part('text/html', html || '')}\r\n--${boundary}--`;

  return Buffer.from(mime).toString('base64url');
};

const sendViaGmailApi = async (message) => {
  const token = await getGmailAccessToken();
  const res = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: buildMime(message) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Gmail API send failed (${res.status}): ${detail.slice(0, 200)}`
    );
  }
  return res.json();
};

// Generic sender used by every caller (verification, reset, new-login, contact).
export const sendMail = async ({ to, subject, html, text, replyTo, from = FROM }) => {
  const message = { from, to, subject, html, text };
  if (replyTo) message.replyTo = replyTo;

  if (PROVIDER === 'smtp') return sendViaSmtp(message);
  if (PROVIDER === 'gmail_api') {
    if (!isEmailConfigured()) {
      throw new Error(
        'Email provider is not configured: Gmail API credentials are missing'
      );
    }
    return withTimeout(sendViaGmailApi(message), TIMEOUT_MS, 'Gmail send');
  }

  const resend = getResend();
  if (!resend) {
    throw new Error('Email provider is not configured: RESEND_API_KEY is missing');
  }

  const { data, error } = await withTimeout(
    resend.emails.send(message),
    TIMEOUT_MS,
    'Resend send'
  );
  if (error) throw new Error(error.message || 'Resend send failed');
  return data;
};

export const sendOrderConfirmation = async (to, order) => {
  const items = order.OrderItems?.map(i => `<li>${i.Product?.name} x ${i.quantity} - £${(i.price*i.quantity).toFixed(2)}</li>`).join('') || '';
  const html = `<h2>Order ${order.id}</h2><p>Total: £${order.total_amount}</p><ul>${items}</ul>`;
  await sendMail({ to, subject: 'Order confirmation', html });
};

export const sendPasswordResetEmail = async (to, resetLink) => {
  const html = `
    <h2>Password Reset Request</h2>
    <p>You requested to reset your FreshMart password.</p>
    <p>
      Click the link below to reset your password. This link expires in 1 hour.
    </p>
    <p><a href="${resetLink}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;
  await sendMail({
    to,
    subject: 'Reset your FreshMart password',
    html,
  });
};

export const sendNewLoginEmail = async (to, { ip, userAgent, when } = {}) => {
  const time = when ? new Date(when).toUTCString() : new Date().toUTCString();
  const html = `
    <h2>New sign-in to your FreshMart account</h2>
    <p>We noticed a sign-in from a new location or device:</p>
    <ul>
      <li><strong>Time:</strong> ${time}</li>
      <li><strong>IP address:</strong> ${ip || 'unknown'}</li>
      <li><strong>Device:</strong> ${userAgent || 'unknown'}</li>
    </ul>
    <p>If this was you, no action is needed. If you don't recognise this activity,
    reset your password immediately and review your active sessions.</p>
  `;
  await sendMail({
    to,
    subject: 'New sign-in to your FreshMart account',
    html,
  });
};


