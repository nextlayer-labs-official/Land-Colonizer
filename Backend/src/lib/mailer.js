const nodemailer = require('nodemailer');
const prisma = require('./prisma');

// Outgoing email is configured in the server .env (e.g. Zoho ZeptoMail / CPaaS SMTP):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM_EMAIL, MAIL_FROM_NAME (optional), SMTP_SECURE (optional)
// The "Enable email notifications" switch stays in Settings (database).
function smtpConfig() {
  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    host:      (process.env.SMTP_HOST || '').trim(),
    port,
    secure:    process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    user:      (process.env.SMTP_USER || '').trim(),
    pass:      process.env.SMTP_PASS || '',
    fromEmail: (process.env.MAIL_FROM_EMAIL || '').trim(),
    fromName:  (process.env.MAIL_FROM_NAME || '').trim(),
  };
}

function isConfigured(c = smtpConfig()) {
  return !!(c.host && c.user && c.pass && c.fromEmail);
}

let cached = null; // reuse one transporter while the .env values stay the same
function getTransporter() {
  const c = smtpConfig();
  if (!isConfigured(c)) return null;
  const key = `${c.host}|${c.port}|${c.secure}|${c.user}|${c.pass}`;
  if (cached?.key !== key) {
    cached = { key, transporter: nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass } }) };
  }
  return cached.transporter;
}

async function getFromAddress() {
  const c = smtpConfig();
  let name = c.fromName;
  if (!name) {
    const settings = await prisma.companySettings.findFirst();
    name = settings?.company_name || 'AMS';
  }
  return `"${name.replace(/"/g, '')}" <${c.fromEmail}>`;
}

// Safe summary for the Settings page (never includes the password)
function smtpStatus() {
  const c = smtpConfig();
  return { configured: isConfigured(c), host: c.host || null, port: c.port, secure: c.secure, from_email: c.fromEmail || null, from_name: c.fromName || null };
}

async function isSmtpConfigured() {
  return isConfigured();
}

async function isEmailEnabled() {
  if (!isConfigured()) return false;
  const settings = await prisma.companySettings.findFirst();
  return !!settings?.email_notifications;
}

// For approval/rejection notifications — respects the email_notifications toggle
async function sendMail({ to, subject, html }) {
  try {
    if (!(await isEmailEnabled())) return;
    const transporter = getTransporter();
    if (!transporter) return;
    await transporter.sendMail({ from: await getFromAddress(), to, subject, html });
  } catch (err) {
    console.error('[Mailer] Failed to send email:', err.message);
  }
}

// For critical emails (password reset, test email) — sends whenever SMTP is configured, ignores the toggle
async function sendMailCritical({ to, subject, html }) {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.warn('[Mailer] SMTP not configured in .env — cannot send critical email to', to);
      return { skipped: true, reason: 'SMTP is not configured in the server .env' };
    }
    await transporter.sendMail({ from: await getFromAddress(), to, subject, html });
    return { sent: true };
  } catch (err) {
    console.error('[Mailer] Failed to send critical email:', err.message);
    return { skipped: true, reason: err.message };
  }
}

module.exports = { sendMail, sendMailCritical, isEmailEnabled, isSmtpConfigured, smtpStatus };
